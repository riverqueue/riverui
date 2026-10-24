package prohandler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivershared/util/sliceutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro/driver"

	"riverqueue.com/riverui/internal/riveruidriver"
	"riverqueue.com/riverui/internal/riveruidriver/riveruipostgres"
	"riverqueue.com/riverui/internal/riveruidriver/riveruisqlite"
)

// deadLetterTableName is the table created by River Pro's dead letter queue
// migration.
const deadLetterTableName = "river_job_dead_letter"

// HasDeadLetterTable reports whether the schema has the dead letter table, and
// therefore whether the dead letter endpoints can serve requests.
func HasDeadLetterTable(ctx context.Context, exec riverdriver.Executor, schema string) (bool, error) {
	return exec.TableExists(ctx, &riverdriver.TableExistsParams{
		Schema: schema,
		Table:  deadLetterTableName,
	})
}

func (a *ProAPIBundle[TTx]) requireDeadLetterJobs(ctx context.Context) error {
	exists, err := HasDeadLetterTable(ctx, a.DB, a.Client.Schema())
	if err != nil {
		return fmt.Errorf("error checking dead letter schema support: %w", err)
	}
	if !exists {
		return apierror.NewBadRequest("Dead letter jobs require River Pro's dead letter queue migration.")
	}
	return nil
}

// deadLetterJobListItem is the public shape of a job in the list response. It
// is declared here rather than built on the driver's result, whose JSON tags
// exist to decode a query and shouldn't define the API. IDs are strings so
// JavaScript can preserve the full int64 range.
type deadLetterJobListItem struct {
	ID          int64      `json:"id,string"`
	Attempt     int        `json:"attempt"`
	FinalizedAt *time.Time `json:"finalized_at"`
	Kind        string     `json:"kind"`
	MaxAttempts int        `json:"max_attempts"`
	Queue       string     `json:"queue"`
}

func deadLetterJobListItemFromDriver(job *riveruidriver.JobDeadLetterListResult) *deadLetterJobListItem {
	return &deadLetterJobListItem{
		ID:          job.ID,
		Attempt:     job.Attempt,
		FinalizedAt: job.FinalizedAt,
		Kind:        job.Kind,
		MaxAttempts: job.MaxAttempts,
		Queue:       job.Queue,
	}
}

type deadLetterJob struct {
	*riverJobSerializable

	ID int64 `json:"id,string"`
}

func serializableDeadLetterJob(job *rivertype.JobRow) *deadLetterJob {
	result := internalJobToSerializableJob(job)
	if result.Errors == nil {
		result.Errors = []rivertype.AttemptError{}
	}
	return &deadLetterJob{riverJobSerializable: result, ID: job.ID}
}

type deadLetterJobListEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[deadLetterJobListRequest, listResponse[deadLetterJobListItem]]

	uiDriver riveruidriver.Driver
}

func NewDeadLetterJobListEndpoint[TTx any](bundle ProAPIBundle[TTx]) *deadLetterJobListEndpoint[TTx] {
	return &deadLetterJobListEndpoint[TTx]{ProAPIBundle: bundle, uiDriver: deadLetterUIDriver(bundle.Driver.DatabaseName())}
}

func deadLetterUIDriver(databaseName string) riveruidriver.Driver {
	var uiDriver riveruidriver.Driver
	switch databaseName {
	case riverdriver.DatabaseNamePostgres:
		uiDriver = riveruipostgres.New()
	case riverdriver.DatabaseNameSQLite:
		uiDriver = riveruisqlite.New()
	default:
		panic(fmt.Sprintf("unsupported River UI database %q", databaseName))
	}
	return uiDriver
}

func (*deadLetterJobListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{Pattern: "GET /api/pro/dead-letter-jobs", StatusCode: http.StatusOK}
}

// The validate tags must be literals. Limit's maximum mirrors
// riveruidriver.JobDeadLetterListMaxLimit.
type deadLetterJobListRequest struct {
	IDs        []int64  `json:"-" validate:"omitempty,max=1000,dive,min=1"`
	Kinds      []string `json:"-" validate:"omitempty,max=100,dive,required,max=1024"`
	Priorities []int16  `json:"-" validate:"omitempty,max=4,dive,min=1,max=4"`
	Queues     []string `json:"-" validate:"omitempty,max=100,dive,required,max=1024"`
	Tags       []string `json:"-" validate:"omitempty,max=100,dive,required,max=1024"`
	Limit      *int     `json:"-" validate:"omitempty,min=1,max=200"`
}

// validateDeadLetterText rejects text that the databases can't handle
// consistently. PostgreSQL refuses NUL bytes and invalid UTF-8 in both text and
// jsonb parameters, which would otherwise surface as an internal server error,
// while SQLite accepts them.
func validateDeadLetterText(param string, values ...string) error {
	for _, value := range values {
		if strings.ContainsRune(value, 0) || !utf8.ValidString(value) {
			return apierror.NewBadRequestf("Invalid `%s` value: must be valid UTF-8 without NUL bytes.", param)
		}
	}
	return nil
}

func (req *deadLetterJobListRequest) ExtractRaw(r *http.Request) error {
	query := r.URL.Query()
	req.Kinds, req.Queues, req.Tags = query["kinds"], query["queues"], query["tags"]
	if err := validateDeadLetterText("kinds", req.Kinds...); err != nil {
		return err
	}
	if err := validateDeadLetterText("queues", req.Queues...); err != nil {
		return err
	}
	if err := validateDeadLetterText("tags", req.Tags...); err != nil {
		return err
	}
	for _, value := range query["ids"] {
		id, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return apierror.NewBadRequestf("Invalid job ID %q.", value)
		}
		req.IDs = append(req.IDs, id)
	}
	for _, value := range query["priorities"] {
		priority, err := strconv.ParseInt(value, 10, 16)
		if err != nil {
			return apierror.NewBadRequestf("Invalid priority %q.", value)
		}
		req.Priorities = append(req.Priorities, int16(priority))
	}
	if limitString := r.URL.Query().Get("limit"); limitString != "" {
		limit, err := strconv.Atoi(limitString)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}
		req.Limit = &limit
	}
	return nil
}

func (a *deadLetterJobListEndpoint[TTx]) Execute(ctx context.Context, req *deadLetterJobListRequest) (*listResponse[deadLetterJobListItem], error) {
	if err := a.requireDeadLetterJobs(ctx); err != nil {
		return nil, err
	}
	jobs, err := a.uiDriver.GetExecutor(a.DB).JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{
		Filters: riveruidriver.JobDeadLetterFilters{IDs: req.IDs, Kinds: req.Kinds, Priorities: req.Priorities, Queues: req.Queues, Tags: req.Tags},
		Max:     ptrutil.ValOrDefault(req.Limit, riveruidriver.JobDeadLetterListMaxDefault),
		Schema:  a.Client.Schema(),
	})
	if err != nil {
		return nil, fmt.Errorf("error listing dead letter jobs: %w", err)
	}
	return listResponseFrom(sliceutil.Map(jobs, deadLetterJobListItemFromDriver)), nil
}

type deadLetterJobRequest struct {
	JobID int64 `json:"-" validate:"required,min=1"`
}

func (req *deadLetterJobRequest) ExtractRaw(r *http.Request) error {
	jobID, err := strconv.ParseInt(r.PathValue("job_id"), 10, 64)
	if err != nil {
		return apierror.NewBadRequestf("Couldn't convert job ID to int64: %s.", err)
	}
	req.JobID = jobID
	return nil
}

type deadLetterJobGetEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[deadLetterJobRequest, deadLetterJob]
}

func NewDeadLetterJobGetEndpoint[TTx any](bundle ProAPIBundle[TTx]) *deadLetterJobGetEndpoint[TTx] {
	return &deadLetterJobGetEndpoint[TTx]{ProAPIBundle: bundle}
}

func (*deadLetterJobGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{Pattern: "GET /api/pro/dead-letter-jobs/{job_id}", StatusCode: http.StatusOK}
}

func (a *deadLetterJobGetEndpoint[TTx]) Execute(ctx context.Context, req *deadLetterJobRequest) (*deadLetterJob, error) {
	if err := a.requireDeadLetterJobs(ctx); err != nil {
		return nil, err
	}
	job, err := a.DB.JobDeadLetterGetByID(ctx, &driver.JobDeadLetterGetByIDParams{ID: req.JobID, Schema: a.Client.Schema()})
	if errors.Is(err, rivertype.ErrNotFound) {
		return nil, apierror.NewNotFoundf("Dead letter job with ID %d not found. It may already have been retried.", req.JobID)
	}
	if err != nil {
		return nil, fmt.Errorf("error getting dead letter job: %w", err)
	}
	return serializableDeadLetterJob(job), nil
}

type deadLetterJobRetryEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[deadLetterJobRequest, deadLetterJob]
}

func NewDeadLetterJobRetryEndpoint[TTx any](bundle ProAPIBundle[TTx]) *deadLetterJobRetryEndpoint[TTx] {
	return &deadLetterJobRetryEndpoint[TTx]{ProAPIBundle: bundle}
}

func (*deadLetterJobRetryEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{Pattern: "POST /api/pro/dead-letter-jobs/{job_id}/retry", StatusCode: http.StatusOK}
}

func (a *deadLetterJobRetryEndpoint[TTx]) Execute(ctx context.Context, req *deadLetterJobRequest) (*deadLetterJob, error) {
	if err := a.requireDeadLetterJobs(ctx); err != nil {
		return nil, err
	}
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*deadLetterJob, error) {
		result, err := a.Client.JobDeadLetterRetryTx(ctx, a.Driver.UnwrapTx(execTx), req.JobID)
		if errors.Is(err, rivertype.ErrNotFound) {
			return nil, apierror.NewNotFoundf("Dead letter job with ID %d not found. It may already have been retried.", req.JobID)
		}
		if err != nil {
			return nil, fmt.Errorf("error retrying dead letter job: %w", err)
		}
		// A skipped insert must roll back the deletion from the dead letter queue.
		if result.UniqueSkippedAsDuplicate {
			return nil, &apierror.APIError{
				Message:    "Job can't be retried because another active job has the same unique properties. Wait for it to finish before retrying.",
				StatusCode: http.StatusConflict,
			}
		}
		return serializableDeadLetterJob(result.Job), nil
	})
}

type deadLetterAutocompleteEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[deadLetterAutocompleteRequest, listResponse[string]]

	uiDriver riveruidriver.Driver
}

func NewDeadLetterAutocompleteEndpoint[TTx any](bundle ProAPIBundle[TTx]) *deadLetterAutocompleteEndpoint[TTx] {
	return &deadLetterAutocompleteEndpoint[TTx]{ProAPIBundle: bundle, uiDriver: deadLetterUIDriver(bundle.Driver.DatabaseName())}
}

func (*deadLetterAutocompleteEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{Pattern: "GET /api/pro/dead-letter-jobs/autocomplete", StatusCode: http.StatusOK}
}

// The validate tags must be literals. Facet's values mirror the
// riveruidriver.JobDeadLetterFacet constants.
type deadLetterAutocompleteRequest struct {
	Facet   riveruidriver.JobDeadLetterFacet `json:"-" validate:"required,oneof=job_kind queue_name"`
	Match   string                           `json:"-" validate:"max=1024"`
	Exclude []string                         `json:"-" validate:"omitempty,max=100,dive,max=1024"`
}

func (req *deadLetterAutocompleteRequest) ExtractRaw(r *http.Request) error {
	query := r.URL.Query()
	req.Facet, req.Match, req.Exclude = riveruidriver.JobDeadLetterFacet(query.Get("facet")), query.Get("match"), query["exclude"]
	if err := validateDeadLetterText("match", req.Match); err != nil {
		return err
	}
	return validateDeadLetterText("exclude", req.Exclude...)
}

func (a *deadLetterAutocompleteEndpoint[TTx]) Execute(ctx context.Context, req *deadLetterAutocompleteRequest) (*listResponse[string], error) {
	if err := a.requireDeadLetterJobs(ctx); err != nil {
		return nil, err
	}
	values, err := a.uiDriver.GetExecutor(a.DB).JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{
		Facet: req.Facet, Match: req.Match, Exclude: req.Exclude, Max: riveruidriver.JobDeadLetterAutocompleteMaxLimit, Schema: a.Client.Schema(),
	})
	if err != nil {
		return nil, err
	}
	return listResponseFrom(sliceutil.Map(values, func(value string) *string { return &value })), nil
}
