package prohandler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivershared/util/sliceutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro"
	riverprodriver "riverqueue.com/riverpro/driver"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/riverproui/internal/uitype"
)

type ProAPIBundle[TTx any] struct {
	apibundle.APIBundle[TTx]
	Client *riverpro.Client[TTx]
	DB     riverprodriver.ProExecutor
}

type listResponse[T any] struct {
	Data []*T `json:"data"`
}

func listResponseFrom[T any](data []*T) *listResponse[T] {
	return &listResponse[T]{Data: data}
}

//
// producerListEndpoint
//

type producerListEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[producerListRequest, listResponse[uitype.RiverProducer]]
}

func NewProducerListEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *producerListEndpoint[TTx] {
	return &producerListEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*producerListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/producers",
		StatusCode: http.StatusOK,
	}
}

type producerListRequest struct {
	QueueName string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *producerListRequest) ExtractRaw(r *http.Request) error {
	if queueName := r.URL.Query().Get("queue_name"); queueName != "" {
		req.QueueName = queueName
	}

	return nil
}

func (a *producerListEndpoint[TTx]) Execute(ctx context.Context, req *producerListRequest) (*listResponse[uitype.RiverProducer], error) {
	result, err := a.DB.ProducerListByQueue(ctx, &riverprodriver.ProducerListByQueueParams{
		QueueName: req.QueueName,
		Schema:    "", // TODO: need to inject schema from Client or params
	})
	if err != nil {
		return nil, fmt.Errorf("error listing producers: %w", err)
	}
	return listResponseFrom(sliceutil.Map(result, internalProducerToSerializableProducer)), nil
}

func internalProducerToSerializableProducer(internal *riverprodriver.ProducerListByQueueResult) *uitype.RiverProducer {
	var concurrency *uitype.ConcurrencyConfig
	if len(internal.Producer.Metadata) > 0 {
		var metadata struct {
			Concurrency uitype.ConcurrencyConfig `json:"concurrency"`
		}
		if err := json.Unmarshal(internal.Producer.Metadata, &metadata); err == nil {
			concurrency = &metadata.Concurrency
		}
	}

	return &uitype.RiverProducer{
		ID:          internal.Producer.ID,
		ClientID:    internal.Producer.ClientID,
		Concurrency: concurrency,
		CreatedAt:   internal.Producer.CreatedAt,
		MaxWorkers:  int(internal.Producer.MaxWorkers),
		PausedAt:    internal.Producer.PausedAt,
		QueueName:   internal.Producer.QueueName,
		Running:     internal.Running,
		UpdatedAt:   internal.Producer.UpdatedAt,
	}
}

//
// workflowGetEndpoint
//

type workflowGetEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[workflowGetRequest, workflowGetResponse]
}

func NewWorkflowGetEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *workflowGetEndpoint[TTx] {
	return &workflowGetEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*workflowGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/workflows/{id}",
		StatusCode: http.StatusOK,
	}
}

type workflowGetRequest struct {
	ID string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *workflowGetRequest) ExtractRaw(r *http.Request) error {
	req.ID = r.PathValue("id")
	return nil
}

type workflowGetResponse struct {
	Tasks []*riverJobSerializable `json:"tasks"`
}

func (a *workflowGetEndpoint[TTx]) Execute(ctx context.Context, req *workflowGetRequest) (*workflowGetResponse, error) {
	jobs, err := a.DB.WorkflowJobList(ctx, &riverprodriver.WorkflowJobListParams{
		PaginationLimit:  1000,
		PaginationOffset: 0,
		WorkflowID:       req.ID,
	})
	if err != nil {
		return nil, fmt.Errorf("error getting workflow jobs: %w", err)
	}

	if len(jobs) < 1 {
		return nil, apierror.NewNotFoundf("Workflow not found: %s.", req.ID)
	}

	return &workflowGetResponse{
		Tasks: sliceutil.Map(jobs, internalJobToSerializableJob),
	}, nil
}

//
// workflowListEndpoint
//

type workflowListEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[workflowListRequest, listResponse[workflowListItem]]
}

func NewWorkflowListEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *workflowListEndpoint[TTx] {
	return &workflowListEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*workflowListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/workflows",
		StatusCode: http.StatusOK,
	}
}

type workflowListRequest struct {
	After *string `json:"-" validate:"omitempty"`                       // from ExtractRaw
	Limit *int    `json:"-" validate:"omitempty,min=0,max=1000"`        // from ExtractRaw
	State string  `json:"-" validate:"omitempty,oneof=active inactive"` // from ExtractRaw
}

func (req *workflowListRequest) ExtractRaw(r *http.Request) error {
	if after := r.URL.Query().Get("after"); after != "" {
		req.After = (&after)
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}

		req.Limit = &limit
	}

	if state := r.URL.Query().Get("state"); state != "" {
		req.State = (state)
	}

	return nil
}

func (a *workflowListEndpoint[TTx]) Execute(ctx context.Context, req *workflowListRequest) (*listResponse[workflowListItem], error) {
	switch req.State {
	case "active":
		workflows, err := a.DB.WorkflowListActive(ctx, &riverprodriver.WorkflowListParams{
			After:           ptrutil.ValOrDefault(req.After, ""),
			PaginationLimit: min(ptrutil.ValOrDefault(req.Limit, 100), 1000),
		})
		if err != nil {
			return nil, fmt.Errorf("error listing workflows: %w", err)
		}

		return listResponseFrom(sliceutil.Map(workflows, workflowListItemFromInternal)), nil
	case "inactive":
		workflows, err := a.DB.WorkflowListInactive(ctx, &riverprodriver.WorkflowListParams{
			After:           ptrutil.ValOrDefault(req.After, ""),
			PaginationLimit: min(ptrutil.ValOrDefault(req.Limit, 100), 1000),
		})
		if err != nil {
			return nil, fmt.Errorf("error listing workflows: %w", err)
		}
		return listResponseFrom(sliceutil.Map(workflows, workflowListItemFromInternal)), nil
	default:
		workflows, err := a.DB.WorkflowListAll(ctx, &riverprodriver.WorkflowListParams{
			After:           ptrutil.ValOrDefault(req.After, ""),
			PaginationLimit: min(ptrutil.ValOrDefault(req.Limit, 100), 1000),
		})
		if err != nil {
			return nil, fmt.Errorf("error listing workflows: %w", err)
		}
		return listResponseFrom(sliceutil.Map(workflows, workflowListItemFromInternal)), nil
	}
}

type riverJobMinimal struct {
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

type riverJobSerializable struct {
	riverJobMinimal
	Errors   []rivertype.AttemptError `json:"errors"`
	Metadata json.RawMessage          `json:"metadata"`
}

func internalJobToSerializableJob(internal *rivertype.JobRow) *riverJobSerializable {
	attemptedBy := internal.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}

	minimal := riverJobMinimal{
		ID:          internal.ID,
		Args:        internal.EncodedArgs,
		Attempt:     internal.Attempt,
		AttemptedAt: internal.AttemptedAt,
		AttemptedBy: attemptedBy,
		CreatedAt:   internal.CreatedAt,
		FinalizedAt: internal.FinalizedAt,
		Kind:        internal.Kind,
		MaxAttempts: internal.MaxAttempts,
		Priority:    internal.Priority,
		Queue:       internal.Queue,
		State:       string(internal.State),
		ScheduledAt: internal.ScheduledAt,
		Tags:        internal.Tags,
	}

	return &riverJobSerializable{
		riverJobMinimal: minimal,
		Errors:          internal.Errors,
		Metadata:        internal.Metadata,
	}
}

type workflowListItem struct {
	CountAvailable  int       `json:"count_available"`
	CountCancelled  int       `json:"count_cancelled"`
	CountCompleted  int       `json:"count_completed"`
	CountDiscarded  int       `json:"count_discarded"`
	CountFailedDeps int       `json:"count_failed_deps"`
	CountPending    int       `json:"count_pending"`
	CountRetryable  int       `json:"count_retryable"`
	CountRunning    int       `json:"count_running"`
	CountScheduled  int       `json:"count_scheduled"`
	CreatedAt       time.Time `json:"created_at"`
	ID              string    `json:"id"`
	Name            *string   `json:"name"`
}

func workflowListItemFromInternal(internal *riverprodriver.WorkflowListItem) *workflowListItem {
	return &workflowListItem{
		CountAvailable:  internal.CountAvailable,
		CountCancelled:  internal.CountCancelled,
		CountCompleted:  internal.CountCompleted,
		CountDiscarded:  internal.CountDiscarded,
		CountFailedDeps: internal.CountFailedDeps,
		CountPending:    internal.CountPending,
		CountRetryable:  internal.CountRetryable,
		CountRunning:    internal.CountRunning,
		CountScheduled:  internal.CountScheduled,
		CreatedAt:       internal.CreatedAt,
		ID:              internal.ID,
		Name:            internal.Name,
	}
}
