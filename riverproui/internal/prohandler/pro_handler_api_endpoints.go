package prohandler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivershared/util/sliceutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro"
	riverprodriver "riverqueue.com/riverpro/driver"
	"riverqueue.com/riverpro/riverworkflow"

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
// periodicJobListEndpoint
//

type periodicJobListEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[periodicJobListRequest, listResponse[uitype.RiverPeriodicJob]]
}

func NewPeriodicJobListEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *periodicJobListEndpoint[TTx] {
	return &periodicJobListEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*periodicJobListEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/periodic-jobs",
		StatusCode: http.StatusOK,
	}
}

type periodicJobListRequest struct {
	Limit *int `json:"-" validate:"omitempty,min=0,max=1000"` // from ExtractRaw
}

func (req *periodicJobListRequest) ExtractRaw(r *http.Request) error {
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}

		req.Limit = &limit
	}

	return nil
}

func (a *periodicJobListEndpoint[TTx]) Execute(ctx context.Context, req *periodicJobListRequest) (*listResponse[uitype.RiverPeriodicJob], error) {
	result, err := a.DB.PeriodicJobGetAll(ctx, &riverprodriver.PeriodicJobGetAllParams{
		Max:                   ptrutil.ValOrDefault(req.Limit, 100),
		Schema:                a.Client.Schema(),
		StaleUpdatedAtHorizon: time.Now().Add(-24 * time.Hour),
	})
	if err != nil {
		return nil, fmt.Errorf("error listing periodic jobs: %w", err)
	}

	return listResponseFrom(sliceutil.Map(result, internalPeriodicJobToSerializablePeriodicJob)), nil
}

func internalPeriodicJobToSerializablePeriodicJob(internal *riverprodriver.PeriodicJob) *uitype.RiverPeriodicJob {
	return (*uitype.RiverPeriodicJob)(internal)
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
		Schema:    a.Client.Schema(),
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
// workflowCancelEndpoint
//

type workflowCancelEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[workflowCancelRequest, workflowCancelResponse]
}

func NewWorkflowCancelEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *workflowCancelEndpoint[TTx] {
	return &workflowCancelEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*workflowCancelEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/pro/workflows/{id}/cancel",
		StatusCode: http.StatusOK,
	}
}

type workflowCancelRequest struct {
	ID string `json:"-" validate:"required"` // from ExtractRaw
}

func (req *workflowCancelRequest) ExtractRaw(r *http.Request) error {
	req.ID = r.PathValue("id")
	return nil
}

type workflowCancelResponse struct {
	CancelledJobs []*riverJobMinimal `json:"cancelled_jobs"`
}

func (a *workflowCancelEndpoint[TTx]) Execute(ctx context.Context, req *workflowCancelRequest) (*workflowCancelResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*workflowCancelResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		result, err := a.Client.WorkflowCancelTx(ctx, tx, req.ID)
		if err != nil {
			return nil, fmt.Errorf("error cancelling workflow: %w", err)
		}

		// consistent ordering
		slices.SortFunc(result.CancelledJobs, func(a, b *rivertype.JobRow) int {
			return int(a.ID - b.ID)
		})

		return &workflowCancelResponse{
			CancelledJobs: sliceutil.Map(result.CancelledJobs, internalJobToJobMinimal),
		}, nil
	})
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
	ID    string                      `json:"id"`
	Name  string                      `json:"name"`
	Tasks []*workflowTaskSerializable `json:"tasks"`
}

func (a *workflowGetEndpoint[TTx]) Execute(ctx context.Context, req *workflowGetRequest) (*workflowGetResponse, error) {
	workflow, err := a.Client.WorkflowFromExistingID(ctx, req.ID, nil)
	if err != nil {
		if errors.Is(err, rivertype.ErrNotFound) {
			return nil, apierror.NewNotFoundf("Workflow not found: %s.", req.ID)
		}
		return nil, fmt.Errorf("error loading workflow: %w", err)
	}

	loadedTasks, err := workflow.LoadAll(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("error loading workflow tasks: %w", err)
	}

	taskNames := loadedTasks.Names()
	tasks := make([]*workflowTaskSerializable, 0, len(taskNames))
	for _, taskName := range taskNames {
		task := loadedTasks.Get(taskName)
		serializedTask := internalWorkflowTaskToSerializableTask(task)
		if serializedTask == nil {
			continue
		}
		tasks = append(tasks, serializedTask)
	}

	return &workflowGetResponse{
		ID:    workflow.ID(),
		Name:  workflow.Name(),
		Tasks: tasks,
	}, nil
}

//
// workflowTaskSignalsEndpoint
//

type workflowTaskSignalsEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[workflowTaskSignalsRequest, workflowTaskSignalsResponse]
}

func NewWorkflowTaskSignalsEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *workflowTaskSignalsEndpoint[TTx] {
	return &workflowTaskSignalsEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*workflowTaskSignalsEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "GET /api/pro/workflows/{id}/task-signals",
		StatusCode: http.StatusOK,
	}
}

const (
	workflowTaskSignalsLimitDefault = 20
	workflowTaskSignalsLimitMax     = 100
)

type workflowTaskSignalsRequest struct {
	CursorID *int64 `json:"-" validate:"omitempty"`       // from ExtractRaw
	Desc     *bool  `json:"-" validate:"omitempty"`       // from ExtractRaw
	ID       string `json:"-" validate:"required"`        // from ExtractRaw
	Key      string `json:"-" validate:"omitempty"`       // from ExtractRaw
	Limit    *int   `json:"-" validate:"omitempty,min=1"` // from ExtractRaw
	Scope    string `json:"-" validate:"omitempty"`       // from ExtractRaw
	TaskName string `json:"-" validate:"required"`        // from ExtractRaw
}

func (req *workflowTaskSignalsRequest) ExtractRaw(r *http.Request) error {
	req.ID = r.PathValue("id")
	req.TaskName = r.URL.Query().Get("task_name")
	req.Key = r.URL.Query().Get("key")

	if cursorIDStr := r.URL.Query().Get("cursor_id"); cursorIDStr != "" {
		cursorID, err := strconv.ParseInt(cursorIDStr, 10, 64)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `cursor_id` to integer: %s.", err)
		}
		req.CursorID = &cursorID
	}

	if descStr := r.URL.Query().Get("desc"); descStr != "" {
		desc, err := strconv.ParseBool(descStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `desc` to bool: %s.", err)
		}
		req.Desc = &desc
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			return apierror.NewBadRequestf("Couldn't convert `limit` to integer: %s.", err)
		}
		req.Limit = &limit
	}

	req.Scope = r.URL.Query().Get("scope")

	return nil
}

type workflowTaskSignalsResponse struct {
	HasMore      bool                     `json:"has_more"`
	NextCursorID *int64                   `json:"next_cursor_id,omitempty"`
	Scope        workflowTaskSignalsScope `json:"scope"`
	Signals      []*workflowTaskSignal    `json:"signals"`
}

type workflowTaskSignalsScope struct {
	Attempt int    `json:"attempt"`
	Scope   string `json:"scope"`
}

type workflowTaskSignal struct {
	Attempt   int             `json:"attempt"`
	CreatedAt time.Time       `json:"created_at"`
	ID        int64           `json:"id"`
	Key       string          `json:"key"`
	Payload   json.RawMessage `json:"payload"`
	Source    json.RawMessage `json:"source"`
}

func (a *workflowTaskSignalsEndpoint[TTx]) Execute(ctx context.Context, req *workflowTaskSignalsRequest) (*workflowTaskSignalsResponse, error) {
	workflow, err := a.Client.WorkflowFromExistingID(ctx, req.ID, nil)
	if err != nil {
		if errors.Is(err, rivertype.ErrNotFound) {
			return nil, apierror.NewNotFoundf("Workflow not found: %s.", req.ID)
		}
		return nil, fmt.Errorf("error loading workflow: %w", err)
	}

	result, err := workflow.SignalListForTask(ctx, req.TaskName, &riverpro.WorkflowSignalListForTaskParams{
		CursorID: ptrutil.ValOrDefault(req.CursorID, 0),
		Desc:     ptrutil.ValOrDefault(req.Desc, true),
		Key:      req.Key,
		Limit:    min(ptrutil.ValOrDefault(req.Limit, workflowTaskSignalsLimitDefault), workflowTaskSignalsLimitMax),
		Scope:    riverpro.WorkflowTaskSignalReadScope(req.Scope),
	})
	if err != nil {
		var signalKeyUndeclaredErr *riverworkflow.SignalKeyUndeclaredError
		if errors.As(err, &signalKeyUndeclaredErr) {
			return nil, apierror.NewBadRequestf("%s.", signalKeyUndeclaredErr)
		}

		var signalTaskDeclaresNoSignalKeysErr *riverworkflow.SignalTaskDeclaresNoSignalKeysError
		if errors.As(err, &signalTaskDeclaresNoSignalKeysErr) {
			return nil, apierror.NewBadRequestf("%s.", signalTaskDeclaresNoSignalKeysErr)
		}

		var signalUnknownTaskErr *riverworkflow.SignalUnknownTaskError
		if errors.As(err, &signalUnknownTaskErr) {
			return nil, apierror.NewNotFoundf("%s.", signalUnknownTaskErr)
		}

		return nil, fmt.Errorf("error loading task-visible workflow signals: %w", err)
	}

	if result.TaskScope == nil {
		return nil, fmt.Errorf("task-visible workflow signal list missing scope metadata")
	}

	return &workflowTaskSignalsResponse{
		HasMore:      result.HasMore,
		NextCursorID: result.NextCursorID,
		Scope: workflowTaskSignalsScope{
			Attempt: result.TaskScope.Attempt,
			Scope:   string(result.TaskScope.Scope),
		},
		Signals: sliceutil.Map(result.Signals, workflowTaskSignalFromInternal),
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

//
// workflowRetryEndpoint
//

type workflowRetryEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[workflowRetryRequest, workflowRetryResponse]
}

func NewWorkflowRetryEndpoint[TTx any](apiBundle ProAPIBundle[TTx]) *workflowRetryEndpoint[TTx] {
	return &workflowRetryEndpoint[TTx]{ProAPIBundle: apiBundle}
}

func (*workflowRetryEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{
		Pattern:    "POST /api/pro/workflows/{id}/retry",
		StatusCode: http.StatusOK,
	}
}

type workflowRetryRequest struct {
	ID           string `json:"-"             validate:"required"` // from ExtractRaw
	Mode         string `json:"mode"          validate:"omitempty,oneof=all failed_only failed_and_downstream"`
	ResetHistory bool   `json:"reset_history"`
}

func (req *workflowRetryRequest) ExtractRaw(r *http.Request) error {
	req.ID = r.PathValue("id")
	return nil
}

type workflowRetryResponse struct {
	RetriedJobs []*riverJobMinimal `json:"retried_jobs"`
}

func (a *workflowRetryEndpoint[TTx]) Execute(ctx context.Context, req *workflowRetryRequest) (*workflowRetryResponse, error) {
	return dbutil.WithTxV(ctx, a.DB, func(ctx context.Context, execTx riverdriver.ExecutorTx) (*workflowRetryResponse, error) {
		tx := a.Driver.UnwrapTx(execTx)

		// Build workflow wrapper from existing workflow ID
		workflow := a.Client.NewWorkflow(&riverpro.WorkflowOpts{ID: req.ID})

		// Determine retry mode (defaults to "all")
		var mode riverpro.WorkflowRetryMode
		switch req.Mode {
		case "failed_only":
			mode = riverpro.WorkflowRetryModeFailedOnly
		case "failed_and_downstream":
			mode = riverpro.WorkflowRetryModeFailedAndDownstream
		case "", "all":
			mode = riverpro.WorkflowRetryModeAll
		default:
			// validator should prevent this path; keep safe default
			mode = riverpro.WorkflowRetryModeAll
		}

		result, err := workflow.RetryTx(ctx, tx, &riverpro.WorkflowRetryOpts{
			Mode:         mode,
			ResetHistory: req.ResetHistory,
		})
		if err != nil {
			return nil, err
		}

		// consistent ordering
		slices.SortFunc(result.Jobs, func(a, b *rivertype.JobRow) int { return int(a.ID - b.ID) })

		return &workflowRetryResponse{RetriedJobs: sliceutil.Map(result.Jobs, internalJobToJobMinimal)}, nil
	})
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

func internalJobToJobMinimal(internal *rivertype.JobRow) *riverJobMinimal {
	attemptedBy := internal.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}

	return &riverJobMinimal{
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
}

type riverJobSerializable struct {
	riverJobMinimal

	Errors   []rivertype.AttemptError `json:"errors"`
	Metadata json.RawMessage          `json:"metadata"`
}

func internalJobToSerializableJob(internal *rivertype.JobRow) *riverJobSerializable {
	return &riverJobSerializable{
		riverJobMinimal: *internalJobToJobMinimal(internal),
		Errors:          internal.Errors,
		Metadata:        internal.Metadata,
	}
}

const (
	workflowTaskWaitReasonDependencies        = "dependencies"
	workflowTaskWaitReasonDependenciesAndWait = "dependencies_and_wait"
	workflowTaskWaitReasonNone                = "none"
	workflowTaskWaitReasonWait                = "wait"
)

type workflowTaskSerializable struct {
	riverJobSerializable

	Deps                []string          `json:"deps"`
	IgnoreCancelledDeps bool              `json:"ignore_cancelled_deps"`
	IgnoreDeletedDeps   bool              `json:"ignore_deleted_deps"`
	IgnoreDiscardedDeps bool              `json:"ignore_discarded_deps"`
	Name                string            `json:"name"`
	StagedAt            *time.Time        `json:"staged_at,omitempty"`
	Wait                *workflowTaskWait `json:"wait,omitempty"`
	WaitReason          string            `json:"wait_reason"`
	WorkflowID          string            `json:"workflow_id"`
}

type workflowTaskWait struct {
	AsOf       *time.Time                    `json:"as_of,omitempty"`
	Attempt    *int                          `json:"attempt,omitempty"`
	ExprCEL    string                        `json:"expr_cel"`
	ResolvedAt *time.Time                    `json:"resolved_at,omitempty"`
	Phase      string                        `json:"phase"`
	Signals    []*workflowTaskSignalEvidence `json:"signals"`
	StartedAt  *time.Time                    `json:"started_at,omitempty"`
	Summary    string                        `json:"summary,omitempty"`
	Terms      []*workflowTaskWaitTerm       `json:"terms"`
	Timers     []*workflowTaskWaitTimer      `json:"timers"`
}

type workflowTaskWaitTerm struct {
	ExprCEL string `json:"expr_cel,omitempty"`
	Kind    string `json:"kind"`
	Label   string `json:"label"`
	Matched bool   `json:"matched"`
	Name    string `json:"name"`
}

type workflowTaskSignalEvidence struct {
	Key           string `json:"key"`
	LastMatchedID int64  `json:"last_matched_id"`
	LastVisibleID int64  `json:"last_visible_id"`
	Matched       bool   `json:"matched"`
	MatchedCount  int64  `json:"matched_count"`
	VisibleCount  int64  `json:"visible_count"`
}

type workflowTaskWaitTimer struct {
	After        string                       `json:"after,omitempty"`
	AfterUS      *int64                       `json:"after_us,omitempty"`
	AfterSeconds *float64                     `json:"after_seconds,omitempty"`
	Anchor       *workflowTaskWaitTimerAnchor `json:"anchor,omitempty"`
	FireAt       *time.Time                   `json:"fire_at,omitempty"`
	Fired        bool                         `json:"fired"`
	Matched      bool                         `json:"matched"`
	Name         string                       `json:"name"`
}

type workflowTaskWaitTimerAnchor struct {
	Kind string `json:"kind"`
	Task string `json:"task,omitempty"`
}

func internalWorkflowTaskToSerializableTask(task *riverpro.WorkflowTaskWithJob) *workflowTaskSerializable {
	if task == nil || task.Job == nil {
		return nil
	}

	return &workflowTaskSerializable{
		riverJobSerializable: *internalJobToSerializableJob(task.Job),
		Deps:                 task.Deps,
		IgnoreCancelledDeps:  task.IgnoreCancelledDeps,
		IgnoreDeletedDeps:    task.IgnoreDeletedDeps,
		IgnoreDiscardedDeps:  task.IgnoreDiscardedDeps,
		Name:                 task.Name,
		StagedAt:             workflowTaskStagedAtFromMetadata(task.Job.Metadata),
		Wait:                 workflowTaskWaitFromInternal(task.Wait),
		WaitReason:           workflowTaskWaitReasonFromInternal(task.WaitReason),
		WorkflowID:           task.WorkflowID,
	}
}

func workflowTaskWaitReasonFromInternal(waitReason riverpro.WorkflowTaskWaitReason) string {
	switch waitReason {
	case riverpro.WorkflowTaskWaitReasonDependenciesAndWait:
		return workflowTaskWaitReasonDependenciesAndWait
	case riverpro.WorkflowTaskWaitReasonDependencies:
		return workflowTaskWaitReasonDependencies
	case riverpro.WorkflowTaskWaitReasonWait:
		return workflowTaskWaitReasonWait
	default:
		return workflowTaskWaitReasonNone
	}
}

func workflowTaskWaitFromInternal(wait *riverworkflow.Wait) *workflowTaskWait {
	if wait == nil {
		return nil
	}

	result := &workflowTaskWait{
		AsOf:       wait.AsOf,
		Attempt:    wait.Attempt,
		ExprCEL:    wait.Expr,
		ResolvedAt: wait.ResolvedAt,
		Phase:      wait.Phase.String(),
		Signals:    make([]*workflowTaskSignalEvidence, 0, len(wait.Signals)),
		StartedAt:  wait.StartedAt,
		Summary:    wait.Summary,
		Terms:      make([]*workflowTaskWaitTerm, 0, len(wait.Terms)),
		Timers:     make([]*workflowTaskWaitTimer, 0, len(wait.Timers)),
	}

	for i := range wait.Terms {
		term := wait.Terms[i]
		result.Terms = append(result.Terms, &workflowTaskWaitTerm{
			ExprCEL: term.Expr,
			Kind:    string(term.Kind),
			Label:   term.Label,
			Matched: term.Matched,
			Name:    term.Name,
		})
	}

	for i := range wait.Signals {
		signal := wait.Signals[i]
		result.Signals = append(result.Signals, &workflowTaskSignalEvidence{
			Key:           signal.Key,
			LastMatchedID: signal.LastMatchedID,
			LastVisibleID: signal.LastVisibleID,
			Matched:       signal.Matched,
			MatchedCount:  signal.MatchedCount,
			VisibleCount:  signal.VisibleCount,
		})
	}

	for i := range wait.Timers {
		timer := wait.Timers[i]
		serializedTimer := &workflowTaskWaitTimer{
			Fired:   timer.Fired,
			Matched: timer.Matched,
			Name:    timer.Name,
		}

		if timer.After != nil {
			after := *timer.After
			afterUS := after.Microseconds()
			serializedTimer.After = after.String()
			serializedTimer.AfterUS = &afterUS
			afterSeconds := float64(afterUS) / float64(time.Second/time.Microsecond)
			serializedTimer.AfterSeconds = &afterSeconds
		}
		if timer.FireAt != nil {
			serializedTimer.FireAt = timer.FireAt
		}
		if timer.Anchor != nil {
			serializedTimer.Anchor = &workflowTaskWaitTimerAnchor{
				Kind: string(timer.Anchor.Kind),
				Task: timer.Anchor.TaskName,
			}
		}

		result.Timers = append(result.Timers, serializedTimer)
	}

	return result
}

func workflowTaskSignalFromInternal(signal riverworkflow.Signal) *workflowTaskSignal {
	return &workflowTaskSignal{
		Attempt:   signal.Attempt,
		CreatedAt: signal.CreatedAt,
		ID:        signal.ID,
		Key:       signal.Key,
		Payload:   signal.Payload,
		Source:    signal.Source,
	}
}

func workflowTaskStagedAtFromMetadata(metadata json.RawMessage) *time.Time {
	if len(metadata) == 0 {
		return nil
	}

	var metadataView struct {
		WorkflowStagedAt string `json:"workflow_staged_at"`
	}
	if err := json.Unmarshal(metadata, &metadataView); err != nil {
		return nil
	}
	if metadataView.WorkflowStagedAt == "" {
		return nil
	}

	stagedAt, err := time.Parse(time.RFC3339Nano, metadataView.WorkflowStagedAt)
	if err != nil {
		stagedAt, err = time.Parse(time.RFC3339, metadataView.WorkflowStagedAt)
		if err != nil {
			return nil
		}
	}

	return &stagedAt
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
