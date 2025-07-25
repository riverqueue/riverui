package riverui

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"riverqueue.com/riverui/internal/querycacher"
	"riverqueue.com/riverui/internal/util/pgxutil"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/baseservice"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivershared/util/sliceutil"
	"github.com/riverqueue/river/rivertype"
)

// A bundle of common utilities needed for many API endpoints.
type apiBundle struct {
	archetype                *baseservice.Archetype
	client                   *river.Client[pgx.Tx]
	dbPool                   DB
	driver                   riverdriver.Driver[pgx.Tx]
	exec                     riverdriver.Executor
	jobListHideArgsByDefault bool
	logger                   *slog.Logger
}

// SetBundle sets all values to the same as the given bundle.
func (a *apiBundle) SetBundle(bundle *apiBundle) {
	*a = *bundle
}

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

type autocompleteListEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[autocompleteListRequest, listResponse[string]]
}

func newAutocompleteListEndpoint(apiBundle apiBundle) *autocompleteListEndpoint {
	return &autocompleteListEndpoint{apiBundle: apiBundle}
}

func (*autocompleteListEndpoint) Meta() *apiendpoint.EndpointMeta {
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
	Prefix  *string           `json:"-"` // from ExtractRaw
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

	if prefix := r.URL.Query().Get("prefix"); prefix != "" {
		req.Prefix = &prefix
	}

	return nil
}

func (a *autocompleteListEndpoint) Execute(ctx context.Context, req *autocompleteListRequest) (*listResponse[string], error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*listResponse[string], error) {
		prefix := ""
		if req.Prefix != nil {
			prefix = *req.Prefix
		}

		after := ""
		if req.After != nil {
			after = *req.After
		}

		switch req.Facet {
		case autocompleteFacetJobKind:
			kinds, err := a.exec.JobKindListByPrefix(ctx, &riverdriver.JobKindListByPrefixParams{
				After:   after,
				Exclude: req.Exclude,
				Max:     100,
				Prefix:  prefix,
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
			queues, err := a.exec.QueueNameListByPrefix(ctx, &riverdriver.QueueNameListByPrefixParams{
				After:   after,
				Exclude: req.Exclude,
				Max:     100,
				Prefix:  prefix,
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

type featuresGetEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[featuresGetRequest, featuresGetResponse]
}

func newFeaturesGetEndpoint(apiBundle apiBundle) *featuresGetEndpoint {
	return &featuresGetEndpoint{apiBundle: apiBundle}
}

func (*featuresGetEndpoint) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/features",
		StatusCode: http.StatusOK,
	}
}

type featuresGetRequest struct{}

type featuresGetResponse struct {
	Extensions               map[string]bool `json:"extensions"`
	HasClientTable           bool            `json:"has_client_table"`
	HasProducerTable         bool            `json:"has_producer_table"`
	HasSequenceTable         bool            `json:"has_sequence_table"`
	HasWorkflows             bool            `json:"has_workflows"`
	JobListHideArgsByDefault bool            `json:"job_list_hide_args_by_default"`
}

func (a *featuresGetEndpoint) Execute(ctx context.Context, _ *featuresGetRequest) (*featuresGetResponse, error) {
	schema := a.client.Schema()
	hasClientTable, err := a.exec.TableExists(ctx, &riverdriver.TableExistsParams{
		Schema: schema,
		Table:  "river_client",
	})
	if err != nil {
		return nil, err
	}

	hasProducerTable, err := a.exec.TableExists(ctx, &riverdriver.TableExistsParams{
		Schema: schema,
		Table:  "river_producer",
	})
	if err != nil {
		return nil, err
	}

	hasSequenceTable, err := a.exec.TableExists(ctx, &riverdriver.TableExistsParams{
		Schema: schema,
		Table:  "river_job_sequence",
	})
	if err != nil {
		return nil, err
	}

	indexResults, err := a.exec.IndexesExist(ctx, &riverdriver.IndexesExistParams{
		IndexNames: []string{
			"river_job_workflow_list_active",
			"river_job_workflow_scheduling",
		},
		Schema: schema,
	})
	if err != nil {
		return nil, err
	}

	extensions := make(map[string]bool)
	if driverWithExtensions, hasExtensions := a.driver.(driverWithExtensions); hasExtensions {
		extensions = driverWithExtensions.UIExtensions()
	}

	return &featuresGetResponse{
		Extensions:               extensions,
		HasClientTable:           hasClientTable,
		HasProducerTable:         hasProducerTable,
		HasSequenceTable:         hasSequenceTable,
		HasWorkflows:             indexResults["river_job_workflow_list_active"] || indexResults["river_job_workflow_scheduling"],
		JobListHideArgsByDefault: a.jobListHideArgsByDefault,
	}, nil
}

//
// healthCheckGetEndpoint
//

type healthCheckGetEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[healthCheckGetRequest, statusResponse]
}

func newHealthCheckGetEndpoint(apiBundle apiBundle) *healthCheckGetEndpoint {
	return &healthCheckGetEndpoint{apiBundle: apiBundle}
}

func (*healthCheckGetEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *healthCheckGetEndpoint) Execute(ctx context.Context, req *healthCheckGetRequest) (*statusResponse, error) {
	switch req.Name {
	case healthCheckNameComplete:
		if _, err := a.dbPool.Exec(ctx, "SELECT 1"); err != nil {
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

type jobCancelEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newJobCancelEndpoint(apiBundle apiBundle) *jobCancelEndpoint {
	return &jobCancelEndpoint{apiBundle: apiBundle}
}

func (*jobCancelEndpoint) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/cancel",
		StatusCode: http.StatusOK,
	}
}

type jobCancelRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobCancelEndpoint) Execute(ctx context.Context, req *jobCancelRequest) (*statusResponse, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*statusResponse, error) {
		updatedJobs := make(map[int64]*rivertype.JobRow)
		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			job, err := a.client.JobCancelTx(ctx, tx, jobID)
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

type jobDeleteEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobDeleteRequest, statusResponse]
}

func newJobDeleteEndpoint(apiBundle apiBundle) *jobDeleteEndpoint {
	return &jobDeleteEndpoint{apiBundle: apiBundle}
}

func (*jobDeleteEndpoint) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/delete",
		StatusCode: http.StatusOK,
	}
}

type jobDeleteRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobDeleteEndpoint) Execute(ctx context.Context, req *jobDeleteRequest) (*statusResponse, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*statusResponse, error) {
		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			_, err := a.client.JobDeleteTx(ctx, tx, jobID)
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

type jobGetEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobGetRequest, RiverJob]
}

func newJobGetEndpoint(apiBundle apiBundle) *jobGetEndpoint {
	return &jobGetEndpoint{apiBundle: apiBundle}
}

func (*jobGetEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *jobGetEndpoint) Execute(ctx context.Context, req *jobGetRequest) (*RiverJob, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*RiverJob, error) {
		job, err := a.client.JobGetTx(ctx, tx, req.JobID)
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

type jobListEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, listResponse[RiverJobMinimal]]
}

func newJobListEndpoint(apiBundle apiBundle) *jobListEndpoint {
	return &jobListEndpoint{apiBundle: apiBundle}
}

func (*jobListEndpoint) Meta() *apiendpoint.EndpointMeta {
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

	return nil
}

func (a *jobListEndpoint) Execute(ctx context.Context, req *jobListRequest) (*listResponse[RiverJobMinimal], error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*listResponse[RiverJobMinimal], error) {
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

		result, err := a.client.JobListTx(ctx, tx, params)
		if err != nil {
			return nil, fmt.Errorf("error listing jobs: %w", err)
		}

		return listResponseFrom(sliceutil.Map(result.Jobs, riverJobToSerializableJobMinimal)), nil
	})
}

//
// jobRetryEndpoint
//

type jobRetryEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobRetryRequest, statusResponse]
}

func newJobRetryEndpoint(apiBundle apiBundle) *jobRetryEndpoint {
	return &jobRetryEndpoint{apiBundle: apiBundle}
}

func (*jobRetryEndpoint) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/jobs/retry",
		StatusCode: http.StatusOK,
	}
}

type jobRetryRequest struct {
	JobIDs []int64String `json:"ids" validate:"required,min=1,max=1000"`
}

func (a *jobRetryEndpoint) Execute(ctx context.Context, req *jobRetryRequest) (*statusResponse, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*statusResponse, error) {
		for _, jobID := range req.JobIDs {
			jobID := int64(jobID)
			_, err := a.client.JobRetryTx(ctx, tx, jobID)
			if err != nil {
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
// queueGetEndpoint
//

type queueGetEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, RiverQueue]
}

func newQueueGetEndpoint(apiBundle apiBundle) *queueGetEndpoint {
	return &queueGetEndpoint{apiBundle: apiBundle}
}

func (*queueGetEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *queueGetEndpoint) Execute(ctx context.Context, req *queueGetRequest) (*RiverQueue, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*RiverQueue, error) {
		queue, err := a.client.QueueGetTx(ctx, tx, req.Name)
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error getting queue: %w", err)
		}

		countRows, err := a.exec.JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: []string{req.Name},
			Schema:     a.client.Schema(),
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

type queueListEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, listResponse[RiverQueue]]
}

func newQueueListEndpoint(apiBundle apiBundle) *queueListEndpoint {
	return &queueListEndpoint{apiBundle: apiBundle}
}

func (*queueListEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *queueListEndpoint) Execute(ctx context.Context, req *queueListRequest) (*listResponse[RiverQueue], error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*listResponse[RiverQueue], error) {
		result, err := a.client.QueueListTx(ctx, tx, river.NewQueueListParams().First(ptrutil.ValOrDefault(req.Limit, 100)))
		if err != nil {
			return nil, fmt.Errorf("error listing queues: %w", err)
		}

		queueNames := sliceutil.Map(result.Queues, func(q *rivertype.Queue) string { return q.Name })

		countRows, err := a.exec.JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: queueNames,
			Schema:     a.client.Schema(),
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

type queuePauseEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newQueuePauseEndpoint(apiBundle apiBundle) *queuePauseEndpoint {
	return &queuePauseEndpoint{apiBundle: apiBundle}
}

func (*queuePauseEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *queuePauseEndpoint) Execute(ctx context.Context, req *queuePauseRequest) (*statusResponse, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*statusResponse, error) {
		if err := a.client.QueuePauseTx(ctx, tx, req.Name, nil); err != nil {
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

type queueResumeEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, statusResponse]
}

func newQueueResumeEndpoint(apiBundle apiBundle) *queueResumeEndpoint {
	return &queueResumeEndpoint{apiBundle: apiBundle}
}

func (*queueResumeEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *queueResumeEndpoint) Execute(ctx context.Context, req *queueResumeRequest) (*statusResponse, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*statusResponse, error) {
		if err := a.client.QueueResumeTx(ctx, tx, req.Name, nil); err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error resuming queue: %w", err)
		}

		return statusResponseOK, nil
	})
}

type queueUpdateEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[queueUpdateRequest, RiverQueue]
}

func newQueueUpdateEndpoint(apiBundle apiBundle) *queueUpdateEndpoint {
	return &queueUpdateEndpoint{apiBundle: apiBundle}
}

func (*queueUpdateEndpoint) Meta() *apiendpoint.EndpointMeta {
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

func (a *queueUpdateEndpoint) Execute(ctx context.Context, req *queueUpdateRequest) (*RiverQueue, error) {
	return pgxutil.WithTxV(ctx, a.dbPool, func(ctx context.Context, tx pgx.Tx) (*RiverQueue, error) {
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
				metadataStruct := map[string]interface{}{
					"concurrency": req.Concurrency.Value,
				}
				var err error
				metadata, err = json.Marshal(metadataStruct)
				if err != nil {
					return nil, fmt.Errorf("error marshaling metadata: %w", err)
				}
			}
		}

		queue, err := a.client.QueueUpdateTx(ctx, tx, req.Name, &river.QueueUpdateParams{
			Metadata: metadata,
		})
		if err != nil {
			if errors.Is(err, river.ErrNotFound) {
				return nil, NewNotFoundQueue(req.Name)
			}
			return nil, fmt.Errorf("error updating queue metadata: %w", err)
		}

		countRows, err := a.exec.JobCountByQueueAndState(ctx, &riverdriver.JobCountByQueueAndStateParams{
			QueueNames: []string{req.Name},
			Schema:     a.client.Schema(),
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

type stateAndCountGetEndpoint struct {
	apiBundle
	apiendpoint.Endpoint[jobCancelRequest, stateAndCountGetResponse]

	queryCacheSkipThreshold int // constant normally, but settable for testing
	queryCacher             *querycacher.QueryCacher[map[rivertype.JobState]int]
}

func newStateAndCountGetEndpoint(apiBundle apiBundle) *stateAndCountGetEndpoint {
	runQuery := func(ctx context.Context) (map[rivertype.JobState]int, error) {
		return apiBundle.exec.JobCountByAllStates(ctx, &riverdriver.JobCountByAllStatesParams{Schema: apiBundle.client.Schema()})
	}
	return &stateAndCountGetEndpoint{
		apiBundle:               apiBundle,
		queryCacheSkipThreshold: 1_000_000,
		queryCacher:             querycacher.NewQueryCacher(apiBundle.archetype, runQuery),
	}
}

func (*stateAndCountGetEndpoint) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/states",
		StatusCode: http.StatusOK,
	}
}

func (a *stateAndCountGetEndpoint) SubServices() []startstop.Service {
	return []startstop.Service{a.queryCacher}
}

type stateAndCountGetRequest struct{}

type stateAndCountGetResponse struct {
	Available int `json:"available"`
	Cancelled int `json:"cancelled"`
	Completed int `json:"completed"`
	Discarded int `json:"discarded"`
	Pending   int `json:"pending"`
	Retryable int `json:"retryable"`
	Running   int `json:"running"`
	Scheduled int `json:"scheduled"`
}

func (a *stateAndCountGetEndpoint) Execute(ctx context.Context, _ *stateAndCountGetRequest) (*stateAndCountGetResponse, error) {
	// Counts the total number of jobs in a state and count result.
	totalJobs := func(stateAndCountRes map[rivertype.JobState]int) int {
		var totalJobs int
		for _, count := range stateAndCountRes {
			totalJobs += count
		}
		return totalJobs
	}

	// Counting jobs can be an expensive operation given a large table, so in
	// the presence of such, prefer to use a result that's cached periodically
	// instead of querying inline with the API request. In case we don't have a
	// cached result yet or there's a relatively small number of job rows, run
	// the query directly (in the case of the latter so we present the freshest
	// possible information).
	stateAndCountRes, ok := a.queryCacher.CachedRes()
	if !ok || totalJobs(stateAndCountRes) < a.queryCacheSkipThreshold {
		var err error
		stateAndCountRes, err = a.exec.JobCountByAllStates(ctx, &riverdriver.JobCountByAllStatesParams{Schema: a.client.Schema()})
		if err != nil {
			return nil, fmt.Errorf("error getting states and counts: %w", err)
		}
	}

	return &stateAndCountGetResponse{
		Available: stateAndCountRes[rivertype.JobStateAvailable],
		Cancelled: stateAndCountRes[rivertype.JobStateCancelled],
		Completed: stateAndCountRes[rivertype.JobStateCompleted],
		Discarded: stateAndCountRes[rivertype.JobStateDiscarded],
		Pending:   stateAndCountRes[rivertype.JobStatePending],
		Retryable: stateAndCountRes[rivertype.JobStateRetryable],
		Running:   stateAndCountRes[rivertype.JobStateRunning],
		Scheduled: stateAndCountRes[rivertype.JobStateScheduled],
	}, nil
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
	ID          int64           `json:"id"`
	Args        json.RawMessage `json:"args"`
	Attempt     int             `json:"attempt"`
	AttemptedAt *time.Time      `json:"attempted_at"`
	AttemptedBy []string        `json:"attempted_by"`
	CreatedAt   time.Time       `json:"created_at"`
	FinalizedAt *time.Time      `json:"finalized_at"`
	Kind        string          `json:"kind"`
	MaxAttempts int             `json:"max_attempts"`
	Priority    int             `json:"priority"`
	Queue       string          `json:"queue"`
	ScheduledAt time.Time       `json:"scheduled_at"`
	State       string          `json:"state"`
	Tags        []string        `json:"tags"`
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
		Args:        riverJob.EncodedArgs,
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

func internalJobToSerializableJob(internal *rivertype.JobRow) *RiverJob {
	attemptedBy := internal.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}

	minimal := RiverJobMinimal{
		ID:          internal.ID,
		Args:        internal.EncodedArgs,
		Attempt:     int(internal.Attempt),
		AttemptedAt: internal.AttemptedAt,
		AttemptedBy: attemptedBy,
		CreatedAt:   internal.CreatedAt,
		FinalizedAt: internal.FinalizedAt,
		Kind:        internal.Kind,
		MaxAttempts: int(internal.MaxAttempts),
		Priority:    int(internal.Priority),
		Queue:       internal.Queue,
		State:       string(internal.State),
		ScheduledAt: internal.ScheduledAt,
		Tags:        internal.Tags,
	}

	return &RiverJob{
		RiverJobMinimal: minimal,
		Errors:          internal.Errors,
		Metadata:        internal.Metadata,
	}
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
