package riverui

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivershared/util/sliceutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/querycacher"
	"riverqueue.com/riverui/internal/riveruidriver"
	"riverqueue.com/riverui/internal/riveruidriver/riveruipostgres"
	"riverqueue.com/riverui/internal/riveruidriver/riveruisqlite"
)

type listResponse[T any] struct {
	Data []*T `json:"data"`
}

func listResponseFrom[T any](data []*T) *listResponse[T] {
	return &listResponse[T]{Data: data}
}

type statusResponse struct {
	Status string `json:"status"`
}

var statusResponseOK = &statusResponse{Status: "ok"} //nolint:gochecknoglobals

//
// autocompleteListEndpoint
//

type autocompleteListEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[autocompleteListRequest, listResponse[string]]
}

func newAutocompleteListEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *autocompleteListEndpoint[TTx] {
	return &autocompleteListEndpoint[TTx]{APIBundle: bundle}
}

func (*autocompleteListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/autocomplete",
		StatusCode: http.StatusOK,
	}
}

type autocompleteFacet string

const (
	autocompleteFacetJobKind   autocompleteFacet = "job_kind"
	autocompleteFacetQueueName autocompleteFacet = "queue_name"
)

type autocompleteListRequest struct {
	After   *string           `json:"-"` // from ExtractRaw
	Exclude []string          `json:"-"` // from ExtractRaw
	Facet   autocompleteFacet `json:"-"` // from ExtractRaw
	Match   *string           `json:"-"` // from ExtractRaw
}

func (req *autocompleteListRequest) ExtractRaw(r *http.Request) error {
	if after := r.URL.Query().Get("after"); after != "" {
		req.After = &after
	}

	if exclude := r.URL.Query()["exclude"]; len(exclude) > 0 {
		req.Exclude = exclude
	}

	if facet := r.URL.Query().Get("facet"); facet != "" {
		req.Facet = autocompleteFacet(facet)
	}

	if match := r.URL.Query().Get("match"); match != "" {
		req.Match = &match
	}

	return nil
}

func (a *autocompleteListEndpoint[TTx]) Execute(ctx context.Context, req *autocompleteListRequest) (*listResponse[string], error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*listResponse[string], error) {
		tx := a.Driver.UnwrapTx(execTx)

		match := ""
		if req.Match != nil {
			match = *req.Match
		}

		after := ""
		if req.After != nil {
			after = *req.After
		}

		switch req.Facet {
		case autocompleteFacetJobKind:
			kinds, err := a.Driver.UnwrapExecutor(tx).JobKindList(ctx, &riverdriver.JobKindListParams{
				After:   after,
				Exclude: req.Exclude,
				Match:   match,
				Max:     100,
				Schema:  a.Client.Schema(),
			})
			if err != nil {
				return nil, fmt.Errorf("error listing job kinds: %w", err)
			}

			kindPtrs := make([]*string, len(kinds))
			for i, kind := range kinds {
				kindCopy := kind
				kindPtrs[i] = &kindCopy
			}

			return listResponseFrom(kindPtrs), nil

		case autocompleteFacetQueueName:
			queues, err := a.Driver.UnwrapExecutor(tx).QueueNameList(ctx, &riverdriver.QueueNameListParams{
				After:   after,
				Exclude: req.Exclude,
				Match:   match,
				Max:     100,
				Schema:  a.Client.Schema(),
			})
			if err != nil {
				return nil, fmt.Errorf("error listing queue names: %w", err)
			}

			queuePtrs := make([]*string, len(queues))
			for i, queue := range queues {
				queueCopy := queue
				queuePtrs[i] = &queueCopy
			}

			return listResponseFrom(queuePtrs), nil

		default:
			return nil, apierror.NewBadRequestf("Invalid facet %q. Valid facets are: job_kind, queue_name", req.Facet)
		}
	})
}

//
// featuresGetEndpoint
//

type featuresGetEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[featuresGetRequest, featuresGetResponse]
}

func newFeaturesGetEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *featuresGetEndpoint[TTx] {
	return &featuresGetEndpoint[TTx]{APIBundle: bundle}
}

func (*featuresGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/features",
		StatusCode: http.StatusOK,
	}
}

type featuresGetRequest struct{}

type featuresGetResponse struct {
	Extensions               map[string]bool `json:"extensions"`
	JobListHideArgsByDefault bool            `json:"job_list_hide_args_by_default"`
}

func (a *featuresGetEndpoint[TTx]) Execute(ctx context.Context, _ *featuresGetRequest) (*featuresGetResponse, error) {
	extensions, err := a.Extensions(ctx)
	if err != nil {
		return nil, err
	}

	return &featuresGetResponse{
		Extensions:               extensions,
		JobListHideArgsByDefault: a.JobListHideArgsByDefault,
	}, nil
}

//
// healthCheckGetEndpoint
//

type healthCheckGetEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[healthCheckGetRequest, statusResponse]
}

func newHealthCheckGetEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *healthCheckGetEndpoint[TTx] {
	return &healthCheckGetEndpoint[TTx]{APIBundle: bundle}
}

func (*healthCheckGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/health-checks/{name}",
		StatusCode: http.StatusOK,
	}
}

type healthCheckName string

const (
	healthCheckNameComplete healthCheckName = "complete"
	healthCheckNameMinimal  healthCheckName = "minimal"
)

type healthCheckGetRequest struct {
	Name healthCheckName `json:"-"` // from ExtractRaw
}

func (req *healthCheckGetRequest) ExtractRaw(r *http.Request) error {
	req.Name = healthCheckName(r.PathValue("name"))
	return nil
}

func (a *healthCheckGetEndpoint[TTx]) Execute(ctx context.Context, req *healthCheckGetRequest) (*statusResponse, error) {
	switch req.Name {
	case healthCheckNameComplete:
		if err := a.DB.Exec(ctx, "SELECT 1"); err != nil {
			return nil, apierror.WithInternalError(
				apierror.NewServiceUnavailable("Unable to query database. Check logs for details."),
				err,
			)
		}

	case healthCheckNameMinimal:
		// fall through to OK status response below

	default:
		return nil, apierror.NewNotFoundf("Health check %q not found. Use either `complete` or `minimal`.", req.Name)
	}

	return statusResponseOK, nil
}

//
// jobCancelEndpoint
//

type jobCancelEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newJobCancelEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *jobCancelEndpoint[TTx] {
	return &jobCancelEndpoint[TTx]{APIBundle: bundle}
}

func (*jobCancelEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/cancel",
		StatusCode: http.StatusOK,
	}
}

type jobCancelRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobCancelEndpoint[TTx]) Execute(ctx context.Context, req *jobCancelRequest) (*statusResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*statusResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		updatedJobs := make(map[int64]*rivertype.JobRow)
		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			job, err := a.Client.JobCancelTx(ctx, tx, jobID)
			if err != nil {
				if errors.Is(err, river.ErrNotFound) {
					return nil, NewNotFoundJob(jobID)
				}
				return nil, err
			}
			updatedJobs[jobID] = job
		}

		// TODO: return jobs in response, use in frontend instead of invalidating
		return statusResponseOK, nil
	})
}

//
// jobDeleteEndpoint
//

type jobDeleteEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobDeleteRequest, statusResponse]
}

func newJobDeleteEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *jobDeleteEndpoint[TTx] {
	return &jobDeleteEndpoint[TTx]{APIBundle: bundle}
}

func (*jobDeleteEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/delete",
		StatusCode: http.StatusOK,
	}
}

type jobDeleteRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobDeleteEndpoint[TTx]) Execute(ctx context.Context, req *jobDeleteRequest) (*statusResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*statusResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			_, err := a.Client.JobDeleteTx(ctx, tx, jobID)
			if err != nil {
				if errors.Is(err, rivertype.ErrJobRunning) {
					return nil, apierror.NewBadRequestf("Job %d is running and can't be deleted until it finishes.", jobID)
				}
				if errors.Is(err, river.ErrNotFound) {
					return nil, NewNotFoundJob(jobID)
				}
				return nil, err
			}
		}

		return statusResponseOK, nil
	})
}

//
// jobGetEndpoint
//

type jobGetEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobGetRequest, RiverJob]
}

func newJobGetEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *jobGetEndpoint[TTx] {
	return &jobGetEndpoint[TTx]{APIBundle: bundle}
}

func (*jobGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/jobs/{job_id}",
		StatusCode: http.StatusOK,
	}
}

type jobGetRequest struct {
	JobID int64 `json:"-" validate:"required"` // from ExtractRaw
}

func (req *jobGetRequest) ExtractRaw(r *http.Request) error {
	idString := r.PathValue("job_id")

	jobID, err := strconv.ParseInt(idString, 10, 64)
	if err != nil {
		return apierror.NewBadRequestf("Couldn't convert job ID to int64: %s.", err)
	}

	req.JobID = jobID

	return nil
}

func (a *jobGetEndpoint[TTx]) Execute(ctx context.Context, req *jobGetRequest) (*RiverJob, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*RiverJob, error) {
		tx := a.Driver.UnwrapTx(execTx)

		job, err := a.Client.JobGetTx(ctx, tx, req.JobID)
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundJob(req.JobID)
			}
			return nil, fmt.Errorf("error getting job: %w", err)
		}
		return riverJobToSerializableJob(job), nil
	})
}

//
// jobListEndpoint
//

type jobListEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, listResponse[RiverJobMinimal]]
}

func newJobListEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *jobListEndpoint[TTx] {
	return &jobListEndpoint[TTx]{APIBundle: bundle}
}

func (*jobListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/jobs",
		StatusCode: http.StatusOK,
	}
}

type jobListRequest struct {
	IDs        []int64             `json:"-" validate:"omitempty,min=1,max=1000"`                                                                    // from ExtractRaw
	Kinds      []string            `json:"-" validate:"omitempty,max=100"`                                                                           // from ExtractRaw
	Limit      *int                `json:"-" validate:"omitempty,min=0,max=1000"`                                                                    // from ExtractRaw
	Priorities []int16             `json:"-" validate:"omitempty,min=0,max=10"`                                                                      // from ExtractRaw
	Queues     []string            `json:"-" validate:"omitempty,max=100"`                                                                           // from ExtractRaw
	State      *rivertype.JobState `json:"-" validate:"omitempty,oneof=available cancelled completed discarded pending retryable running scheduled"` // from ExtractRaw
	Tags       []string            `json:"-" validate:"omitempty,max=100"`                                                                           // from ExtractRaw
}

func (req *jobListRequest) ExtractRaw(r *http.Request) error {
	if ids := r.URL.Query()["ids"]; len(ids) > 0 {
		req.IDs = sliceutil.Map(ids, func(id string) int64 {
			value, err := strconv.ParseInt(id, 10, 64)
			if err != nil {
				return 0
			}
			return value
		})
	}

	if kinds := r.URL.Query()["kinds"]; len(kinds) > 0 {
		req.Kinds = kinds
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}

		req.Limit = &limit
	}

	if priorities := r.URL.Query()["priorities"]; len(priorities) > 0 {
		req.Priorities = sliceutil.Map(priorities, func(p string) int16 {
			value, err := strconv.ParseInt(p, 10, 16)
			if err != nil {
				return 0
			}
			return int16(value)
		})
	}

	if state := r.URL.Query().Get("state"); state != "" {
		req.State = (*rivertype.JobState)(&state)
	}

	if queues := r.URL.Query()["queues"]; len(queues) > 0 {
		req.Queues = queues
	}

	if tags := r.URL.Query()["tags"]; len(tags) > 0 {
		req.Tags = tags
	}

	return nil
}

func (a *jobListEndpoint[TTx]) Execute(ctx context.Context, req *jobListRequest) (*listResponse[RiverJobMinimal], error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*listResponse[RiverJobMinimal], error) {
		tx := a.Driver.UnwrapTx(execTx)

		params := river.NewJobListParams().First(ptrutil.ValOrDefault(req.Limit, 20))

		if len(req.IDs) > 0 {
			params = params.IDs(req.IDs...)
		}

		if len(req.Kinds) > 0 {
			params = params.Kinds(req.Kinds...)
		}

		if len(req.Priorities) > 0 {
			params = params.Priorities(req.Priorities...)
		}

		if len(req.Queues) > 0 {
			params = params.Queues(req.Queues...)
		}

		if len(req.Tags) > 0 {
			params = params.TagsAny(req.Tags...)
		}

		if req.State == nil {
			params = params.States(rivertype.JobStateRunning).OrderBy(river.JobListOrderByTime, river.SortOrderAsc)
		} else {
			switch *req.State {
			case rivertype.JobStateCancelled, rivertype.JobStateCompleted, rivertype.JobStateDiscarded:
				params = params.States(*req.State).OrderBy(river.JobListOrderByTime, river.SortOrderDesc)
			case rivertype.JobStateAvailable, rivertype.JobStateRetryable, rivertype.JobStatePending, rivertype.JobStateRunning, rivertype.JobStateScheduled:
				params = params.States(*req.State)
			}
		}

		result, err := a.Client.JobListTx(ctx, tx, params)
		if err != nil {
			return nil, fmt.Errorf("error listing jobs: %w", err)
		}

		return listResponseFrom(sliceutil.Map(result.Jobs, riverJobToSerializableJobMinimal)), nil
	})
}

//
// jobRetryEndpoint
//

type jobRetryEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobRetryRequest, statusResponse]
}

func newJobRetryEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *jobRetryEndpoint[TTx] {
	return &jobRetryEndpoint[TTx]{APIBundle: bundle}
}

func (*jobRetryEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/retry",
		StatusCode: http.StatusOK,
	}
}

type jobRetryRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobRetryEndpoint[TTx]) Execute(ctx context.Context, req *jobRetryRequest) (*statusResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*statusResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			_, err := a.Client.JobRetryTx(ctx, tx, jobID)
			if err != nil {
				if errors.Is(err, river.ErrNotFound) {
					return nil, NewNotFoundJob(jobID)
				}
				if isJobRetryUniqueConflict(err) {
					return nil, newJobRetryUniqueConflictError(err)
				}
				return nil, err
			}
		}

		return statusResponseOK, nil
	})
}

const (
	jobRetryUniqueConstraint = "river_job_unique_idx"
	jobRetryUniqueMessage    = "Job can't be retried because another active job has the same unique properties. Wait for it to finish or delete it before retrying."
)

type jobRetryUniqueConflictError struct {
	apierror.APIError
}

func newJobRetryUniqueConflictError(internalErr error) *jobRetryUniqueConflictError {
	return &jobRetryUniqueConflictError{
		APIError: apierror.APIError{
			InternalError: internalErr,
			Message:       jobRetryUniqueMessage,
			StatusCode:    http.StatusConflict,
		},
	}
}

func isJobRetryUniqueConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == pgerrcode.UniqueViolation &&
		pgErr.ConstraintName == jobRetryUniqueConstraint
}

//
// queueGetEndpoint
//

type queueGetEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, RiverQueue]
}

func newQueueGetEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *queueGetEndpoint[TTx] {
	return &queueGetEndpoint[TTx]{APIBundle: bundle}
}

func (*queueGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/queues/{name}",
		StatusCode: http.StatusOK,
	}
}

type queueGetRequest struct {
	Name string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *queueGetRequest) ExtractRaw(r *http.Request) error {
	req.Name = r.PathValue("name")
	return nil
}

func (a *queueGetEndpoint[TTx]) Execute(ctx context.Context, req *queueGetRequest) (*RiverQueue, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*RiverQueue, error) {
		tx := a.Driver.UnwrapTx(execTx)

		queue, err := a.Client.QueueGetTx(ctx, tx, req.Name)
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error getting queue: %w", err)
		}

		countRows, err := a.Driver.UnwrapExecutor(tx).JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: []string{req.Name},
			Schema:     a.Client.Schema(),
		})
		if err != nil {
			return nil, fmt.Errorf("error getting queue counts: %w", err)
		}

		return riverQueueToSerializableQueue(*queue, countRows[0]), nil
	})
}

//
// queueListEndpoint
//

type queueListEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, listResponse[RiverQueue]]
}

func newQueueListEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *queueListEndpoint[TTx] {
	return &queueListEndpoint[TTx]{APIBundle: bundle}
}

func (*queueListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/queues",
		StatusCode: http.StatusOK,
	}
}

type queueListRequest struct {
	Limit *int `json:"-" validate:"omitempty,min=0,max=1000"` // from ExtractRaw
}

func (req *queueListRequest) ExtractRaw(r *http.Request) error {
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}

		req.Limit = &limit
	}

	return nil
}

func (a *queueListEndpoint[TTx]) Execute(ctx context.Context, req *queueListRequest) (*listResponse[RiverQueue], error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*listResponse[RiverQueue], error) {
		tx := a.Driver.UnwrapTx(execTx)

		result, err := a.Client.QueueListTx(ctx, tx, river.NewQueueListParams().First(ptrutil.ValOrDefault(req.Limit, 100)))
		if err != nil {
			return nil, fmt.Errorf("error listing queues: %w", err)
		}

		queueNames := sliceutil.Map(result.Queues, func(q *rivertype.Queue) string { return q.Name })

		countRows, err := a.Driver.UnwrapExecutor(tx).JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: queueNames,
			Schema:     a.Client.Schema(),
		})
		if err != nil {
			return nil, fmt.Errorf("error getting queue counts: %w", err)
		}

		return riverQueuesToSerializableQueues(result.Queues, countRows), nil
	})
}

//
// queuePauseEndpoint
//

type queuePauseEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newQueuePauseEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *queuePauseEndpoint[TTx] {
	return &queuePauseEndpoint[TTx]{APIBundle: bundle}
}

func (*queuePauseEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "PUT /api/queues/{name}/pause",
		StatusCode: http.StatusOK,
	}
}

type queuePauseRequest struct {
	Name string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *queuePauseRequest) ExtractRaw(r *http.Request) error {
	req.Name = r.PathValue("name")
	return nil
}

func (a *queuePauseEndpoint[TTx]) Execute(ctx context.Context, req *queuePauseRequest) (*statusResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*statusResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		err := a.Client.QueuePauseTx(ctx, tx, req.Name, nil)
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error pausing queue: %w", err)
		}

		return statusResponseOK, nil
	})
}

//
// queueResumeEndpoint
//

type queueResumeEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newQueueResumeEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *queueResumeEndpoint[TTx] {
	return &queueResumeEndpoint[TTx]{APIBundle: bundle}
}

func (*queueResumeEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "PUT /api/queues/{name}/resume",
		StatusCode: http.StatusOK,
	}
}

type queueResumeRequest struct {
	Name string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *queueResumeRequest) ExtractRaw(r *http.Request) error {
	req.Name = r.PathValue("name")
	return nil
}

func (a *queueResumeEndpoint[TTx]) Execute(ctx context.Context, req *queueResumeRequest) (*statusResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*statusResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		err := a.Client.QueueResumeTx(ctx, tx, req.Name, nil)
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error resuming queue: %w", err)
		}

		return statusResponseOK, nil
	})
}

type queueUpdateEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[queueUpdateRequest, RiverQueue]
}

func newQueueUpdateEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *queueUpdateEndpoint[TTx] {
	return &queueUpdateEndpoint[TTx]{APIBundle: bundle}
}

func (*queueUpdateEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "PATCH /api/queues/{name}",
		StatusCode: http.StatusOK,
	}
}

type queueUpdateRequest struct {
	Concurrency apitype.ExplicitNullable[ConcurrencyConfig] `json:"concurrency"`
	Name        string                                      `json:"-"           validate:"required"` // from ExtractRaw
}

func (req *queueUpdateRequest) ExtractRaw(r *http.Request) error {
	req.Name = r.PathValue("name")
	return nil
}

func (a *queueUpdateEndpoint[TTx]) Execute(ctx context.Context, req *queueUpdateRequest) (*RiverQueue, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*RiverQueue, error) {
		tx := a.Driver.UnwrapTx(execTx)

		// Construct metadata based on concurrency field
		var metadata json.RawMessage
		if req.Concurrency.Set {
			if req.Concurrency.Value == nil {
				// If concurrency is nil, clear the metadata
				metadata = []byte("{}")
			} else {
				// Ensure consistent sorting of ByArgs:
				slices.Sort(req.Concurrency.Value.Partition.ByArgs)

				// Otherwise, construct metadata with the concurrency config
				metadataStruct := map[string]any{
					"concurrency": req.Concurrency.Value,
				}
				var err error
				metadata, err = json.Marshal(metadataStruct)
				if err != nil {
					return nil, fmt.Errorf("error marshaling metadata: %w", err)
				}
			}
		}

		queue, err := a.Client.QueueUpdateTx(ctx, tx, req.Name, &river.QueueUpdateParams{
			Metadata: metadata,
		})
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error updating queue metadata: %w", err)
		}

		countRows, err := a.Driver.UnwrapExecutor(tx).JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: []string{req.Name},
			Schema:     a.Client.Schema(),
		})
		if err != nil {
			return nil, fmt.Errorf("error getting queue counts: %w", err)
		}

		return riverQueueToSerializableQueue(*queue, countRows[0]), nil
	})
}

//
// stateAndCountGetEndpoint
//

type stateAndCountGetEndpoint[TTx any] struct {
	apibundle.APIBundle[TTx]
	apiendpoint.Endpoint[jobCancelRequest, stateAndCountGetResponse]

	boundedQueryCacher *querycacher.QueryCacher[stateCountSnapshot]
	countMax           int
	estimateCounts     func(ctx context.Context, states []rivertype.JobState) (map[rivertype.JobState]stateCountEstimate, error)
	exactQueryCacher   *querycacher.QueryCacher[stateCountSnapshot]
	driver             riveruidriver.Driver
}

const (
	stateAndCountDefaultMax = 10_000

	// Two missed maximum-interval refreshes make an estimate preferable to an
	// increasingly misleading exact snapshot.
	stateCountExactMaxAge         = 30 * time.Minute
	stateCountExactRefreshMin     = 30 * time.Second
	stateCountExactRefreshMax     = 15 * time.Minute
	stateCountExactRefreshCostMul = 50
)

func newStateAndCountGetEndpoint[TTx any](bundle apibundle.APIBundle[TTx]) *stateAndCountGetEndpoint[TTx] {
	endpoint := &stateAndCountGetEndpoint[TTx]{
		APIBundle: bundle,
		countMax:  stateAndCountDefaultMax,
		driver:    newRiverUIDriver(bundle.Driver.DatabaseName()),
	}
	endpoint.boundedQueryCacher = querycacher.NewQueryCacher(bundle.Archetype, endpoint.queryBoundedCounts)
	endpoint.exactQueryCacher = querycacher.NewQueryCacherWithOpts(
		bundle.Archetype,
		endpoint.queryExactCounts,
		&querycacher.QueryCacherOpts{NextTickPeriod: stateCountExactRefreshPeriod},
	)
	endpoint.estimateCounts = endpoint.queryEstimatedCounts
	return endpoint
}

func newRiverUIDriver(databaseName string) riveruidriver.Driver {
	switch databaseName {
	case riverdriver.DatabaseNamePostgres:
		return riveruipostgres.New()
	case riverdriver.DatabaseNameSQLite:
		return riveruisqlite.New()
	default:
		panic(fmt.Sprintf("unsupported River UI database %q", databaseName))
	}
}

func (*stateAndCountGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/states",
		StatusCode: http.StatusOK,
	}
}

func (a *stateAndCountGetEndpoint[TTx]) SubServices() []startstop.Service {
	return []startstop.Service{a.boundedQueryCacher, a.exactQueryCacher}
}

type stateAndCountGetRequest struct{}

type stateCountAccuracy string

const (
	stateCountAccuracyEstimated   stateCountAccuracy = "estimated"    // uses Postgres planner estimate (Postgres only)
	stateCountAccuracyExact       stateCountAccuracy = "exact"        // exact
	stateCountAccuracyExactCached stateCountAccuracy = "exact_cached" // exact (cached)
	stateCountAccuracyLowerBound  stateCountAccuracy = "lower_bound"  // constrained to stateAndCountDefaultMax
)

type stateCountResponse struct {
	Accuracy   stateCountAccuracy `json:"accuracy"`
	Count      int                `json:"count"`
	ObservedAt *time.Time         `json:"observed_at,omitempty"`
}

type stateAndCountGetResponse struct {
	Available stateCountResponse `json:"available"`
	Cancelled stateCountResponse `json:"cancelled"`
	Completed stateCountResponse `json:"completed"`
	Discarded stateCountResponse `json:"discarded"`
	Pending   stateCountResponse `json:"pending"`
	Retryable stateCountResponse `json:"retryable"`
	Running   stateCountResponse `json:"running"`
	Scheduled stateCountResponse `json:"scheduled"`
}

// Execute resolves every state's count from the cheapest sufficiently useful
// source. A bounded index scan gives fresh exact values for small states. Large
// states prefer a recent exact snapshot refreshed adaptively in the background,
// then a PostgreSQL planner estimate, and finally the bound proven by the index
// scan. Full exact scans are never part of request latency.
func (a *stateAndCountGetEndpoint[TTx]) Execute(ctx context.Context, _ *stateAndCountGetRequest) (*stateAndCountGetResponse, error) {
	countsAreExact := func(snapshot stateCountSnapshot) bool {
		for _, count := range snapshot.Counts {
			if count > a.countMax {
				return false
			}
		}
		return true
	}

	// Prefer fresh counts while every state is below the cap. Once any state is
	// capped, serve the periodically refreshed result to collapse queries from
	// multiple UI clients. Both paths use the same bounded query.
	boundedSnapshot, ok := a.boundedQueryCacher.CachedRes()
	if !ok || countsAreExact(boundedSnapshot) {
		var err error
		boundedSnapshot, err = a.queryBoundedCounts(ctx)
		if err != nil {
			return nil, fmt.Errorf("error getting states and counts: %w", err)
		}
	}

	cappedStates := make([]rivertype.JobState, 0, len(allJobStates))
	for _, state := range allJobStates {
		if boundedSnapshot.Counts[state] > a.countMax {
			cappedStates = append(cappedStates, state)
		}
	}

	var (
		exactSnapshot, hasExactSnapshot = a.exactQueryCacher.CachedRes()
		exactSnapshotIsFresh            = hasExactSnapshot && time.Since(exactSnapshot.ObservedAt) <= stateCountExactMaxAge
	)

	statesNeedingEstimate := make([]rivertype.JobState, 0, len(cappedStates))
	for _, state := range cappedStates {
		if !exactSnapshotIsFresh || exactSnapshot.Counts[state] <= a.countMax {
			statesNeedingEstimate = append(statesNeedingEstimate, state)
		}
	}

	estimates := make(map[rivertype.JobState]stateCountEstimate)
	if len(statesNeedingEstimate) > 0 {
		var err error
		estimates, err = a.estimateCounts(ctx, statesNeedingEstimate)
		if err != nil {
			// Estimates are an optional telemetry enhancement. The bounded count
			// is still trustworthy, so degrade to a lower bound instead of failing
			// the entire sidebar when planner statistics can't be read.
			a.Logger.WarnContext(ctx, "Unable to estimate large job counts", "err", err)
			estimates = make(map[rivertype.JobState]stateCountEstimate)
		}
	}

	resolvedCounts := make(map[rivertype.JobState]stateCountResponse, len(allJobStates))
	for _, state := range allJobStates {
		boundedCount := boundedSnapshot.Counts[state]

		if boundedCount <= a.countMax {
			// The bounded scan reached the end of this state's index range, so the
			// value is exact and fresh even if another, larger state was capped.
			resolvedCounts[state] = stateCountResponse{
				Accuracy:   stateCountAccuracyExact,
				Count:      boundedCount,
				ObservedAt: &boundedSnapshot.ObservedAt,
			}
			continue
		}

		if exactSnapshotIsFresh && exactSnapshot.Counts[state] > a.countMax {
			// A recent full scan preserves the useful magnitude for common large
			// states. Its timestamp makes the deliberate staleness visible.
			resolvedCounts[state] = stateCountResponse{
				Accuracy:   stateCountAccuracyExactCached,
				Count:      exactSnapshot.Counts[state],
				ObservedAt: &exactSnapshot.ObservedAt,
			}
			continue
		}

		if estimate, ok := estimates[state]; ok && estimate.Count > a.countMax {
			// Planner statistics are cheap and retain an order of magnitude during
			// cold start or when the last exact snapshot has become too old.
			resolvedCounts[state] = stateCountResponse{
				Accuracy:   stateCountAccuracyEstimated,
				Count:      estimate.Count,
				ObservedAt: estimate.ObservedAt,
			}
			continue
		}

		// The bounded scan proves only that there are more than countMax rows.
		// Never present a stale planner estimate below that known lower bound.
		resolvedCounts[state] = stateCountResponse{
			Accuracy:   stateCountAccuracyLowerBound,
			Count:      a.countMax,
			ObservedAt: &boundedSnapshot.ObservedAt,
		}
	}

	resp := &stateAndCountGetResponse{
		Available: resolvedCounts[rivertype.JobStateAvailable],
		Cancelled: resolvedCounts[rivertype.JobStateCancelled],
		Completed: resolvedCounts[rivertype.JobStateCompleted],
		Discarded: resolvedCounts[rivertype.JobStateDiscarded],
		Pending:   resolvedCounts[rivertype.JobStatePending],
		Retryable: resolvedCounts[rivertype.JobStateRetryable],
		Running:   resolvedCounts[rivertype.JobStateRunning],
		Scheduled: resolvedCounts[rivertype.JobStateScheduled],
	}

	return resp, nil
}

type stateCountSnapshot struct {
	Counts     map[rivertype.JobState]int
	ObservedAt time.Time
}

type stateCountEstimate = riveruidriver.JobCountEstimateResult

var allJobStates = []rivertype.JobState{ //nolint:gochecknoglobals
	rivertype.JobStateAvailable,
	rivertype.JobStateCancelled,
	rivertype.JobStateCompleted,
	rivertype.JobStateDiscarded,
	rivertype.JobStatePending,
	rivertype.JobStateRetryable,
	rivertype.JobStateRunning,
	rivertype.JobStateScheduled,
}

func (a *stateAndCountGetEndpoint[TTx]) queryBoundedCounts(ctx context.Context) (stateCountSnapshot, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (stateCountSnapshot, error) {
		counts, err := a.driver.GetExecutor(execTx).JobCountByAllStatesCapped(ctx, &riveruidriver.JobCountByAllStatesCappedParams{
			Max:    a.countMax,
			Schema: a.Client.Schema(),
		})
		if err != nil {
			return stateCountSnapshot{}, err
		}
		return stateCountSnapshot{Counts: counts, ObservedAt: time.Now()}, nil
	})
}

func (a *stateAndCountGetEndpoint[TTx]) queryExactCounts(ctx context.Context) (stateCountSnapshot, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (stateCountSnapshot, error) {
		counts, err := execTx.JobCountByAllStates(ctx, &riverdriver.JobCountByAllStatesParams{
			Schema: a.Client.Schema(),
		})
		if err != nil {
			return stateCountSnapshot{}, fmt.Errorf("error counting all jobs by state exactly: %w", err)
		}
		return stateCountSnapshot{Counts: counts, ObservedAt: time.Now()}, nil
	})
}

func stateCountExactRefreshPeriod(queryDuration time.Duration, queryErr error) time.Duration {
	if queryErr != nil {
		// A failed full-table count is likely load-related. Back off to the
		// maximum interval instead of repeatedly adding pressure to the database.
		return stateCountExactRefreshMax
	}

	// Target about two percent of wall time for full exact counts. Fast counts
	// still wait at least 30 seconds, while the maximum keeps exact telemetry
	// reasonably fresh on very large installations.
	refreshPeriod := queryDuration * stateCountExactRefreshCostMul
	return min(max(refreshPeriod, stateCountExactRefreshMin), stateCountExactRefreshMax)
}

// queryEstimatedCounts delegates planner telemetry to the database-specific UI
// driver. Drivers without an estimate strategy return no estimates, causing the
// endpoint to retain the lower bound proven by the capped query.
func (a *stateAndCountGetEndpoint[TTx]) queryEstimatedCounts(ctx context.Context, states []rivertype.JobState) (map[rivertype.JobState]stateCountEstimate, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (map[rivertype.JobState]stateCountEstimate, error) {
		// SQLite has no planner-estimate equivalent, so its UI driver always
		// returns an empty map. With no estimate to resolve a capped state,
		// Execute falls back to the lower bound proven by the bounded count.
		return a.driver.GetExecutor(execTx).JobCountEstimate(ctx, &riveruidriver.JobCountEstimateParams{
			Schema: a.Client.Schema(),
			States: states,
		})
	})
}

func NewNotFoundJob(jobID int64) *apierror.NotFound {
	return apierror.NewNotFoundf("Job not found: %d.", jobID)
}

func NewNotFoundQueue(name string) *apierror.NotFound {
	return apierror.NewNotFoundf("Queue not found: %s.", name)
}

func NewNotFoundWorkflow(id string) *apierror.NotFound {
	return apierror.NewNotFoundf("Workflow not found: %s.", id)
}

type ConcurrencyConfig struct {
	GlobalLimit int32           `json:"global_limit"`
	LocalLimit  int32           `json:"local_limit"`
	Partition   PartitionConfig `json:"partition"`
}

type PartitionConfig struct {
	ByArgs []string `json:"by_args"`
	ByKind bool     `json:"by_kind"`
}

type RiverJobMinimal struct {
	ID          int64      `json:"id"`
	Args        string     `json:"args"`
	Attempt     int        `json:"attempt"`
	AttemptedAt *time.Time `json:"attempted_at"`
	AttemptedBy []string   `json:"attempted_by"`
	CreatedAt   time.Time  `json:"created_at"`
	FinalizedAt *time.Time `json:"finalized_at"`
	Kind        string     `json:"kind"`
	MaxAttempts int        `json:"max_attempts"`
	Priority    int        `json:"priority"`
	Queue       string     `json:"queue"`
	ScheduledAt time.Time  `json:"scheduled_at"`
	State       string     `json:"state"`
	Tags        []string   `json:"tags"`
}

type RiverJob struct {
	RiverJobMinimal

	Errors   []rivertype.AttemptError `json:"errors"`
	Metadata json.RawMessage          `json:"metadata"`
}

func riverJobToSerializableJob(riverJob *rivertype.JobRow) *RiverJob {
	errs := riverJob.Errors
	if errs == nil {
		errs = []rivertype.AttemptError{}
	}

	return &RiverJob{
		RiverJobMinimal: *riverJobToSerializableJobMinimal(riverJob),

		Errors:   errs,
		Metadata: riverJob.Metadata,
	}
}

func riverJobToSerializableJobMinimal(riverJob *rivertype.JobRow) *RiverJobMinimal {
	attemptedBy := riverJob.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}

	return &RiverJobMinimal{
		ID:          riverJob.ID,
		Args:        string(riverJob.EncodedArgs),
		Attempt:     riverJob.Attempt,
		AttemptedAt: riverJob.AttemptedAt,
		AttemptedBy: attemptedBy,
		CreatedAt:   riverJob.CreatedAt,
		FinalizedAt: riverJob.FinalizedAt,
		Kind:        riverJob.Kind,
		MaxAttempts: riverJob.MaxAttempts,
		Priority:    riverJob.Priority,
		Queue:       riverJob.Queue,
		State:       string(riverJob.State),
		ScheduledAt: riverJob.ScheduledAt.UTC(),
		Tags:        riverJob.Tags,
	}
}

type RiverQueue struct {
	CountAvailable int                `json:"count_available"`
	CountRunning   int                `json:"count_running"`
	CreatedAt      time.Time          `json:"created_at"`
	Concurrency    *ConcurrencyConfig `json:"concurrency"`
	Name           string             `json:"name"`
	PausedAt       *time.Time         `json:"paused_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

func riverQueueToSerializableQueue(internal rivertype.Queue, count *riverdriver.JobCountByQueueAndStateResult) *RiverQueue {
	var concurrency *ConcurrencyConfig
	if len(internal.Metadata) > 0 {
		var metadata struct {
			Concurrency *ConcurrencyConfig `json:"concurrency"`
		}
		if err := json.Unmarshal(internal.Metadata, &metadata); err == nil {
			concurrency = metadata.Concurrency
		}
	}

	return &RiverQueue{
		CountAvailable: int(count.CountAvailable),
		CountRunning:   int(count.CountRunning),
		CreatedAt:      internal.CreatedAt,
		Concurrency:    concurrency,
		Name:           internal.Name,
		PausedAt:       internal.PausedAt,
		UpdatedAt:      internal.UpdatedAt,
	}
}

func riverQueuesToSerializableQueues(internal []*rivertype.Queue, counts []*riverdriver.JobCountByQueueAndStateResult) *listResponse[RiverQueue] {
	countsMap := make(map[string]*riverdriver.JobCountByQueueAndStateResult)
	for _, count := range counts {
		countsMap[count.Queue] = count
	}

	queues := make([]*RiverQueue, len(internal))
	for i, internalQueue := range internal {
		queues[i] = riverQueueToSerializableQueue(*internalQueue, countsMap[internalQueue.Name])
	}
	return listResponseFrom(queues)
}
