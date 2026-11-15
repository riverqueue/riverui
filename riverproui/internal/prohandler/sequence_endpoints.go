package prohandler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro"
)

// SequenceIndexNames are the indexes sequence inspection reads through. Both
// come with River Pro's first migration, and the SQLite queries name them
// explicitly, so inspecting without them fails instead of scanning.
var SequenceIndexNames = []string{ //nolint:gochecknoglobals
	"idx_river_job_non_pending_seq_key_id_desc",
	"river_job_sequence_scheduling",
}

// HasSequenceQueries reports whether the indexes that sequence inspection
// needs are installed.
func HasSequenceQueries(ctx context.Context, exec riverdriver.Executor, schema string) (bool, error) {
	for _, index := range SequenceIndexNames {
		exists, err := exec.IndexExists(ctx, &riverdriver.IndexExistsParams{Index: index, Schema: schema})
		if err != nil {
			return false, err
		}
		if !exists {
			return false, nil
		}
	}
	return true, nil
}

// sequenceQueryTimeout bounds a single sequence request. Inspection cost grows
// with the cancelled or discarded jobs that allow continuation ahead of a
// sequence's next job, and a page that polls shouldn't hold a connection for
// long on an unusual sequence.
const sequenceQueryTimeout = 5 * time.Second

// sequencePendingCountMax caps how many pending jobs are counted for a halted
// sequence. Beyond this, the UI only says there are more.
const sequencePendingCountMax = 1000

// sequenceIndexCheck remembers that the sequence indexes exist, so a page that
// polls a sequence endpoint doesn't query the catalog on every request.
// Indexes are only removed by down migrations, which also remove sequences.
type sequenceIndexCheck struct {
	confirmed atomic.Bool
}

func (c *sequenceIndexCheck) require(ctx context.Context, exec riverdriver.Executor, schema string) error {
	if c.confirmed.Load() {
		return nil
	}
	supported, err := HasSequenceQueries(ctx, exec, schema)
	if err != nil {
		return fmt.Errorf("error checking sequence indexes: %w", err)
	}
	if !supported {
		return apierror.NewBadRequest("Sequence queries require River Pro's sequence indexes. Run the River Pro migrations.")
	}
	c.confirmed.Store(true)
	return nil
}

type sequenceJobResponse struct {
	ID          int64              `json:"id,string"`
	Kind        string             `json:"kind"`
	Queue       string             `json:"queue"`
	ScheduledAt time.Time          `json:"scheduled_at"`
	State       rivertype.JobState `json:"state"`
}

func sequenceJobResponseFrom(job *riverpro.SequenceJobRef) *sequenceJobResponse {
	if job == nil {
		return nil
	}
	return &sequenceJobResponse{
		ID:          job.ID,
		Kind:        job.Kind,
		Queue:       job.Queue,
		ScheduledAt: job.ScheduledAt.UTC(),
		State:       job.State,
	}
}

type sequencePendingCountResponse struct {
	Count int  `json:"count"`
	More  bool `json:"more"`
}

// sequenceInspectionResponse is a sequence's promotion state. It's shared by
// the job and sequence endpoints.
type sequenceInspectionResponse struct {
	Blockers []*sequenceJobResponse `json:"blockers"`
	HaltedBy *sequenceJobResponse   `json:"halted_by"`
	Head     *sequenceJobResponse   `json:"head"`
	Key      string                 `json:"key"`

	// PendingCount is the sequence's pending job count, capped at
	// sequencePendingCountMax. It's null when it wasn't requested.
	PendingCount *sequencePendingCountResponse `json:"pending_count"`
}

func sequenceInspectionResponseFrom(inspection *riverpro.SequenceInspectResult) *sequenceInspectionResponse {
	blockers := make([]*sequenceJobResponse, len(inspection.Blockers))
	for i, blocker := range inspection.Blockers {
		blockers[i] = sequenceJobResponseFrom(blocker)
	}
	return &sequenceInspectionResponse{
		Blockers: blockers,
		HaltedBy: sequenceJobResponseFrom(inspection.HaltedBy),
		Head:     sequenceJobResponseFrom(inspection.Head),
		Key:      inspection.Key,
	}
}

func sequenceCountPendingTx[TTx any](ctx context.Context, client *riverpro.Client[TTx], tx TTx, key string) (*sequencePendingCountResponse, error) {
	result, err := client.SequenceCountPendingTx(ctx, tx, &riverpro.SequenceCountPendingParams{
		Key: key,
		Max: sequencePendingCountMax,
	})
	if err != nil {
		return nil, fmt.Errorf("error counting pending sequence jobs: %w", err)
	}
	return &sequencePendingCountResponse{Count: result.Count, More: result.HasMore}, nil
}

//
// jobSequenceGetEndpoint
//

type jobSequenceGetEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[jobSequenceGetRequest, jobSequenceGetResponse]

	indexCheck sequenceIndexCheck
}

// NewJobSequenceGetEndpoint returns an endpoint explaining where a job stands
// in its sequence.
func NewJobSequenceGetEndpoint[TTx any](bundle ProAPIBundle[TTx]) *jobSequenceGetEndpoint[TTx] {
	return &jobSequenceGetEndpoint[TTx]{ProAPIBundle: bundle}
}

func (*jobSequenceGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/jobs/{job_id}/sequence",
		StatusCode: http.StatusOK,
	}
}

type jobSequenceGetRequest struct {
	JobID int64 `json:"-" validate:"required,min=1"` // from ExtractRaw
}

func (req *jobSequenceGetRequest) ExtractRaw(r *http.Request) error {
	id, err := strconv.ParseInt(r.PathValue("job_id"), 10, 64)
	if err != nil {
		return apierror.NewBadRequestf("Couldn't convert job ID to int64: %s.", err)
	}
	req.JobID = id
	return nil
}

type jobSequenceGetResponse struct {
	// Halting is true when the job is cancelled or discarded, doesn't let its
	// sequence continue, and pending jobs follow it.
	Halting  bool                        `json:"halting"`
	JobID    int64                       `json:"job_id,string"`
	JobState rivertype.JobState          `json:"job_state"`
	Sequence *sequenceInspectionResponse `json:"sequence"`

	// WaitReason is one of `halted`, `none`, `up_next`,
	// `waiting_behind_pending`, or `waiting_on_active`.
	WaitReason riverpro.SequencePendingReason `json:"wait_reason"`
	WaitingOn  *sequenceJobResponse           `json:"waiting_on"`
}

func (a *jobSequenceGetEndpoint[TTx]) Execute(ctx context.Context, req *jobSequenceGetRequest) (*jobSequenceGetResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, sequenceQueryTimeout)
	defer cancel()

	if err := a.indexCheck.require(ctx, a.DB, a.Client.Schema()); err != nil {
		return nil, err
	}

	// Inspect and count in one transaction so a halting job's count describes
	// the same snapshot as its inspection.
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*jobSequenceGetResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		inspection, err := a.Client.SequenceJobInspectTx(ctx, tx, req.JobID)
		if err != nil {
			if errors.Is(err, rivertype.ErrNotFound) {
				return nil, apierror.NewNotFoundf("Job %d isn't in a sequence.", req.JobID)
			}
			return nil, fmt.Errorf("error inspecting job sequence: %w", err)
		}

		sequence := sequenceInspectionResponseFrom(inspection.Sequence)
		// A halting job's delete warning says how many jobs would run without
		// it. Other jobs don't need the count.
		if inspection.Halting {
			sequence.PendingCount, err = sequenceCountPendingTx(ctx, a.Client, tx, inspection.Sequence.Key)
			if err != nil {
				return nil, err
			}
		}

		return &jobSequenceGetResponse{
			Halting:    inspection.Halting,
			JobID:      inspection.Job.ID,
			JobState:   inspection.Job.State,
			Sequence:   sequence,
			WaitReason: inspection.PendingReason,
			WaitingOn:  sequenceJobResponseFrom(inspection.WaitingOn),
		}, nil
	})
}

//
// sequenceGetEndpoint
//

type sequenceGetEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[sequenceGetRequest, sequenceInspectionResponse]

	indexCheck sequenceIndexCheck
}

// NewSequenceGetEndpoint returns an endpoint reporting a sequence's promotion
// state by key.
func NewSequenceGetEndpoint[TTx any](bundle ProAPIBundle[TTx]) *sequenceGetEndpoint[TTx] {
	return &sequenceGetEndpoint[TTx]{ProAPIBundle: bundle}
}

func (*sequenceGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	// Sequence keys are often base64, so the key goes in the query string where
	// `/` and `+` survive proxies that decode paths.
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/sequence",
		StatusCode: http.StatusOK,
	}
}

type sequenceGetRequest struct {
	Key string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *sequenceGetRequest) ExtractRaw(r *http.Request) error {
	req.Key = r.URL.Query().Get("key")
	return nil
}

func (a *sequenceGetEndpoint[TTx]) Execute(ctx context.Context, req *sequenceGetRequest) (*sequenceInspectionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, sequenceQueryTimeout)
	defer cancel()

	if err := a.indexCheck.require(ctx, a.DB, a.Client.Schema()); err != nil {
		return nil, err
	}

	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*sequenceInspectionResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		inspection, err := a.Client.SequenceInspectTx(ctx, tx, req.Key)
		if err != nil {
			return nil, fmt.Errorf("error inspecting sequence: %w", err)
		}

		resp := sequenceInspectionResponseFrom(inspection)
		resp.PendingCount = &sequencePendingCountResponse{}
		// Nothing is pending without a head, so skip the count.
		if inspection.Head != nil {
			resp.PendingCount, err = sequenceCountPendingTx(ctx, a.Client, tx, inspection.Key)
			if err != nil {
				return nil, err
			}
		}
		return resp, nil
	})
}

//
// sequenceJobListEndpoint
//

type sequenceJobListEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[sequenceJobListRequest, sequenceJobListResponse]

	indexCheck sequenceIndexCheck
}

// NewSequenceJobListEndpoint returns an endpoint listing a page of a
// sequence's jobs in ID order.
func NewSequenceJobListEndpoint[TTx any](bundle ProAPIBundle[TTx]) *sequenceJobListEndpoint[TTx] {
	return &sequenceJobListEndpoint[TTx]{ProAPIBundle: bundle}
}

func (*sequenceJobListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/sequence/jobs",
		StatusCode: http.StatusOK,
	}
}

type sequenceJobListRequest struct {
	AfterID  *int64 `json:"-" validate:"omitempty,min=0"`          // from ExtractRaw
	BeforeID *int64 `json:"-" validate:"omitempty,min=0"`          // from ExtractRaw
	Key      string `json:"-" validate:"required"`                 // from ExtractRaw
	Limit    int    `json:"-" validate:"omitempty,min=1,max=1000"` // from ExtractRaw
}

func (req *sequenceJobListRequest) ExtractRaw(r *http.Request) error {
	query := r.URL.Query()
	req.Key = query.Get("key")

	// A cursor of zero is meaningful: `after_id=0` lists from the first job.
	parseID := func(name string) (*int64, error) {
		value := query.Get(name)
		if value == "" {
			return nil, nil //nolint:nilnil
		}
		id, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return nil, apierror.NewBadRequestf("Couldn't convert `%s` to int64: %s.", name, err)
		}
		return &id, nil
	}

	var err error
	if req.AfterID, err = parseID("after_id"); err != nil {
		return err
	}
	if req.BeforeID, err = parseID("before_id"); err != nil {
		return err
	}
	if req.AfterID != nil && req.BeforeID != nil {
		return apierror.NewBadRequest("Only one of `after_id` and `before_id` may be set.")
	}

	if limitStr := query.Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}
		req.Limit = limit
	}
	return nil
}

type sequenceJobListItemResponse struct {
	ID          int64              `json:"id,string"`
	Args        string             `json:"args"`
	Attempt     int                `json:"attempt"`
	AttemptedAt *time.Time         `json:"attempted_at"`
	CreatedAt   time.Time          `json:"created_at"`
	FinalizedAt *time.Time         `json:"finalized_at"`
	Kind        string             `json:"kind"`
	MaxAttempts int                `json:"max_attempts"`
	Priority    int                `json:"priority"`
	Queue       string             `json:"queue"`
	ScheduledAt time.Time          `json:"scheduled_at"`
	State       rivertype.JobState `json:"state"`
}

// sequenceJobListResponse is a page of a sequence's jobs in ascending ID
// order, which is run order. HasEarlier and HasLater say whether jobs exist
// past either end of the page, so the UI can offer to load them.
type sequenceJobListResponse struct {
	Data       []*sequenceJobListItemResponse `json:"data"`
	HasEarlier bool                           `json:"has_earlier"`
	HasLater   bool                           `json:"has_later"`
}

func (a *sequenceJobListEndpoint[TTx]) Execute(ctx context.Context, req *sequenceJobListRequest) (*sequenceJobListResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, sequenceQueryTimeout)
	defer cancel()

	if err := a.indexCheck.require(ctx, a.DB, a.Client.Schema()); err != nil {
		return nil, err
	}

	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*sequenceJobListResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		page, err := a.Client.SequenceJobListTx(ctx, tx, &riverpro.SequenceJobListParams{
			AfterID:  req.AfterID,
			BeforeID: req.BeforeID,
			Key:      req.Key,
			Max:      req.Limit,
		})
		if err != nil {
			return nil, fmt.Errorf("error listing sequence jobs: %w", err)
		}

		resp := &sequenceJobListResponse{
			Data:       make([]*sequenceJobListItemResponse, len(page.Jobs)),
			HasEarlier: page.HasEarlier,
			HasLater:   page.HasLater,
		}
		for i, job := range page.Jobs {
			resp.Data[i] = sequenceJobListItemResponseFrom(job)
		}
		return resp, nil
	})
}

func sequenceJobListItemResponseFrom(item *riverpro.SequenceJobListItem) *sequenceJobListItemResponse {
	job := item.Job
	return &sequenceJobListItemResponse{
		ID:          job.ID,
		Args:        string(job.EncodedArgs),
		Attempt:     job.Attempt,
		AttemptedAt: job.AttemptedAt,
		CreatedAt:   job.CreatedAt,
		FinalizedAt: job.FinalizedAt,
		Kind:        job.Kind,
		MaxAttempts: job.MaxAttempts,
		Priority:    job.Priority,
		Queue:       job.Queue,
		ScheduledAt: job.ScheduledAt.UTC(),
		State:       job.State,
	}
}
