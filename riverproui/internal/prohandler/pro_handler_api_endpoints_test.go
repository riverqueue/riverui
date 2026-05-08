package prohandler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/riversharedtest"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver"
	"riverqueue.com/riverpro/driver/riverpropgxv5"
	"riverqueue.com/riverpro/riverworkflow"

	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/uicommontest"
	"riverqueue.com/riverui/riverproui/internal/protestfactory"
)

type setupEndpointTestBundle struct {
	client *riverpro.Client[pgx.Tx]
	exec   driver.ProExecutor
	logger *slog.Logger
	schema string
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle ProAPIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger    = riversharedtest.Logger(t)
		pool      = riversharedtest.DBPool(ctx, t)
		proDriver = riverpropgxv5.New(pool)
		schema    = riverdbtest.TestSchema(ctx, t, proDriver, &riverdbtest.TestSchemaOpts{DisableReuse: true})
		exec      = proDriver.GetProExecutor()
	)
	client, err := riverpro.NewClient(proDriver, &riverpro.Config{
		Config: river.Config{
			Logger: logger,
			Schema: schema,
		},
	})
	require.NoError(t, err)

	endpoint := initFunc(ProAPIBundle[pgx.Tx]{
		APIBundle: apibundle.APIBundle[pgx.Tx]{
			Archetype: riversharedtest.BaseServiceArchetype(t),
			Client:    client.Client,
			DB:        exec,
			Driver:    proDriver,
			// Extensions aren't needed for any of these test endpoints
			Extensions: func(_ context.Context) (map[string]bool, error) { return map[string]bool{}, nil },
			Logger:     logger,
		},
		Client: client,
		DB:     exec,
	})

	if service, ok := any(endpoint).(startstop.Service); ok {
		require.NoError(t, service.Start(ctx))
		t.Cleanup(service.Stop)
	}

	return endpoint, &setupEndpointTestBundle{
		client: client,
		exec:   exec,
		logger: logger,
		schema: schema,
	}
}

func testMountOpts(t *testing.T) *apiendpoint.MountOpts {
	t.Helper()
	return &apiendpoint.MountOpts{
		Logger:    riversharedtest.Logger(t),
		Validator: apitype.NewValidator(),
	}
}

func TestProAPIHandlerPeriodicJobList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewPeriodicJobListEndpoint)

		job1 := protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{ID: ptrutil.Ptr("alpha"), NextRunAt: ptrutil.Ptr(time.Now().Add(time.Minute)), Schema: bundle.schema})
		job2 := protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{ID: ptrutil.Ptr("beta"), NextRunAt: ptrutil.Ptr(time.Now().Add(2 * time.Minute)), Schema: bundle.schema})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &periodicJobListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewPeriodicJobListEndpoint)

		job1 := protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{Schema: bundle.schema})
		_ = protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{Schema: bundle.schema})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &periodicJobListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job1.ID, resp.Data[0].ID)
	})
}

func TestProAPIHandlerWorkflowCancel(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessWithOnlyPendingJobs", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowCancelEndpoint)

		job1 := makeWorkflowJob(ctx, t, bundle.exec, bundle.schema, "123", "task_1", nil)
		job2 := makeWorkflowJob(ctx, t, bundle.exec, bundle.schema, "123", "task_2", []string{"task_1"})
		job3 := makeWorkflowJob(ctx, t, bundle.exec, bundle.schema, "123", "task_3", []string{"task_1", "task_2"})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowCancelRequest{ID: "123"})
		require.NoError(t, err)

		require.Len(t, resp.CancelledJobs, 3)
		require.Equal(t, []int64{job1.ID, job2.ID, job3.ID}, []int64{resp.CancelledJobs[0].ID, resp.CancelledJobs[1].ID, resp.CancelledJobs[2].ID})
	})
}

func TestProAPIHandlerWorkflowGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessIncludesWaitAndWaitReason", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowGetEndpoint)
		require.NoError(t, bundle.exec.WorkflowInsertMany(ctx, &driver.WorkflowInsertManyParams{
			IDs:    []string{"wf_get"},
			Names:  []string{"wf_get"},
			Schema: bundle.schema,
		}))

		now := time.Now().UTC().Truncate(time.Second)
		waitSpec := &riverworkflow.WaitSpec{
			Expr: "collect_inputs_ready && (approval_received || review_sla)",
			Terms: []riverworkflow.WaitTermSpec{
				riverworkflow.WaitTerm("collect_inputs_ready", `deps["collect_inputs"].output.ready == true`).Label("Inputs collected"),
				riverworkflow.WaitTermSignal("approval_received", "approval", `payload.approved == true`).Label("Approval received"),
				riverworkflow.WaitTermTimer(riverworkflow.TimerAfterWorkflowCreated("review_sla", 30*time.Minute)).Label("Review SLA reached"),
			},
		}

		dependencyJob := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(now.Add(-2 * time.Minute)),
			Metadata:    workflowMetadata("wf_get", "collect_inputs", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})

		waitingJob := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			Metadata: workflowMetadataWithWait("wf_get", "await_review", []string{"collect_inputs"}, waitSpec, map[string]any{
				"started_at": now.Format(time.RFC3339Nano),
				"timers": map[string]any{
					"review_sla": map[string]any{
						"fire_at": now.Add(30 * time.Minute).Format(time.RFC3339Nano),
					},
				},
			}),
			State: ptrutil.Ptr(rivertype.JobStatePending),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowGetRequest{ID: "wf_get"})
		require.NoError(t, err)
		require.Equal(t, "wf_get", resp.ID)
		require.Equal(t, "wf_get", resp.Name)
		require.Len(t, resp.Tasks, 2)

		taskByID := map[int64]*workflowTaskSerializable{}
		for _, task := range resp.Tasks {
			taskByID[task.ID] = task
		}

		require.Equal(t, workflowTaskWaitReasonNone, taskByID[dependencyJob.ID].WaitReason)
		require.Nil(t, taskByID[dependencyJob.ID].Wait)

		waitingTask := taskByID[waitingJob.ID]
		require.NotNil(t, waitingTask)
		require.Equal(t, "await_review", waitingTask.Name)
		require.Equal(t, "wf_get", waitingTask.WorkflowID)
		require.Equal(t, []string{"collect_inputs"}, waitingTask.Deps)
		require.Equal(t, workflowTaskWaitReasonWait, waitingTask.WaitReason)
		require.NotNil(t, waitingTask.Wait)
		require.Equal(t, "waiting", waitingTask.Wait.Phase)
		require.Equal(t, waitSpec.Expr, waitingTask.Wait.ExprCEL)
		require.NotNil(t, waitingTask.Wait.StartedAt)
		require.Nil(t, waitingTask.Wait.ResolvedAt)
		require.Len(t, waitingTask.Wait.Terms, 3)
		require.Len(t, waitingTask.Wait.Inputs.Signals, 1)
		require.Len(t, waitingTask.Wait.Inputs.Timers, 1)
		require.Equal(t, "collect_inputs_ready", waitingTask.Wait.Terms[0].Name)
		require.Equal(t, `deps["collect_inputs"].output.ready == true`, waitingTask.Wait.Terms[0].ExprCEL)
		require.Equal(t, "approval_received", waitingTask.Wait.Terms[1].Name)
		require.Equal(t, `payload.approved == true`, waitingTask.Wait.Terms[1].ExprCEL)
		require.Equal(t, "review_sla", waitingTask.Wait.Terms[2].Name)
		require.Empty(t, waitingTask.Wait.Terms[2].ExprCEL)

		require.Equal(t, "approval", waitingTask.Wait.Inputs.Signals[0].Key)
		require.Nil(t, waitingTask.Wait.Inputs.Signals[0].Result)

		timer := waitingTask.Wait.Inputs.Timers[0]
		require.Equal(t, "review_sla", timer.Name)
		require.NotEmpty(t, timer.After)
		require.NotNil(t, timer.AfterUS)
		require.NotNil(t, timer.AfterSeconds)
		require.InDelta(t, 1800, *timer.AfterSeconds, 0.001)
		require.NotNil(t, timer.Anchor)
		require.Equal(t, string(riverworkflow.TimerAnchorKindWorkflowCreatedAt), timer.Anchor.Kind)
		require.NotNil(t, timer.FireAt)
		require.Nil(t, timer.Result)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, NewWorkflowGetEndpoint)
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowGetRequest{ID: "does-not-exist"})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Workflow not found")
	})
}

func TestProAPIHandlerWorkflowListRequiresV2Tables(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowListEndpoint)
	dropWorkflowV2Tables(ctx, t, bundle)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowListRequest{})
	require.Nil(t, resp)
	require.Error(t, err)
	require.Contains(t, err.Error(), "River Pro migrations version 6")
}

func TestProAPIHandlerWorkflowTaskSignals(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessReturnsSignalHistoryForTaskNamesWithSlash", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "approval",
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.False(t, resp.HasMore)
		require.Nil(t, resp.NextCursorID)
		require.Equal(t, workflowTaskSignalScopeHistory, resp.Scope)
		require.Len(t, resp.Signals, 3)
		require.Equal(t, []int64{fixture.thirdSignal.ID, fixture.secondSignal.ID, fixture.firstSignal.ID}, []int64{resp.Signals[0].ID, resp.Signals[1].ID, resp.Signals[2].ID})
	})

	t.Run("EvidenceScopeReturnsIncludedSignals", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "approval",
			Scope:    workflowTaskSignalScopeEvidence,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeEvidence, resp.Scope)
		require.Len(t, resp.Signals, 2)
		require.Equal(t, []int64{fixture.secondSignal.ID, fixture.firstSignal.ID}, []int64{resp.Signals[0].ID, resp.Signals[1].ID})
		require.Equal(t, []int{1, 1}, []int{resp.Signals[0].Attempt, resp.Signals[1].Attempt})
	})

	t.Run("EvidenceScopeUsesEvidenceAttemptAndBoundary", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)
		attemptTwoSignal := signalApprovalOnAttempt(ctx, t, bundle, fixture.workflowID, 2)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "approval",
			Scope:    workflowTaskSignalScopeEvidence,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeEvidence, resp.Scope)
		require.Len(t, resp.Signals, 2)
		require.Equal(t, []int64{fixture.secondSignal.ID, fixture.firstSignal.ID}, []int64{resp.Signals[0].ID, resp.Signals[1].ID})
		require.NotContains(t, []int64{resp.Signals[0].ID, resp.Signals[1].ID}, fixture.thirdSignal.ID)
		require.NotContains(t, []int64{resp.Signals[0].ID, resp.Signals[1].ID}, attemptTwoSignal.ID)
		require.Equal(t, []int{1, 1}, []int{resp.Signals[0].Attempt, resp.Signals[1].Attempt})
	})

	t.Run("HistoryScopeDefaultsToCurrentWorkflowAttempt", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)
		attemptTwoSignal := signalApprovalOnAttempt(ctx, t, bundle, fixture.workflowID, 2)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "approval",
			Scope:    workflowTaskSignalScopeHistory,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeHistory, resp.Scope)
		require.Len(t, resp.Signals, 1)
		require.Equal(t, attemptTwoSignal.ID, resp.Signals[0].ID)
		require.Equal(t, 2, resp.Signals[0].Attempt)
	})

	t.Run("HistoryScopeUsesRequestedWorkflowAttempt", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)
		attempt := 1
		attemptTwoSignal := signalApprovalOnAttempt(ctx, t, bundle, fixture.workflowID, 2)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:              fixture.workflowID,
			Key:             "approval",
			Scope:           workflowTaskSignalScopeHistory,
			TaskName:        fixture.taskName,
			WorkflowAttempt: &attempt,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeHistory, resp.Scope)
		require.Len(t, resp.Signals, 3)
		require.Equal(t, []int64{fixture.thirdSignal.ID, fixture.secondSignal.ID, fixture.firstSignal.ID}, []int64{resp.Signals[0].ID, resp.Signals[1].ID, resp.Signals[2].ID})
		require.NotContains(t, []int64{resp.Signals[0].ID, resp.Signals[1].ID, resp.Signals[2].ID}, attemptTwoSignal.ID)
		require.Equal(t, []int{1, 1, 1}, []int{resp.Signals[0].Attempt, resp.Signals[1].Attempt, resp.Signals[2].Attempt})
	})

	t.Run("HistoryScopeWithoutKeyReturnsAllDeclaredSignals", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Scope:    workflowTaskSignalScopeHistory,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeHistory, resp.Scope)
		require.Len(t, resp.Signals, 4)
		require.Equal(t,
			[]int64{fixture.thirdSignal.ID, fixture.escalationSignal.ID, fixture.secondSignal.ID, fixture.firstSignal.ID},
			[]int64{resp.Signals[0].ID, resp.Signals[1].ID, resp.Signals[2].ID, resp.Signals[3].ID},
		)
		require.Equal(t, []string{"approval", "escalation", "approval", "approval"}, []string{resp.Signals[0].Key, resp.Signals[1].Key, resp.Signals[2].Key, resp.Signals[3].Key})
		require.Equal(t, []int{1, 1, 1, 1}, []int{resp.Signals[0].Attempt, resp.Signals[1].Attempt, resp.Signals[2].Attempt, resp.Signals[3].Attempt})
	})

	t.Run("EvidenceScopeWithoutKeyReturnsAllIncludedDeclaredSignals", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Scope:    workflowTaskSignalScopeEvidence,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeEvidence, resp.Scope)
		require.Len(t, resp.Signals, 3)
		require.Equal(t,
			[]int64{fixture.escalationSignal.ID, fixture.secondSignal.ID, fixture.firstSignal.ID},
			[]int64{resp.Signals[0].ID, resp.Signals[1].ID, resp.Signals[2].ID},
		)
		require.Equal(t, []string{"escalation", "approval", "approval"}, []string{resp.Signals[0].Key, resp.Signals[1].Key, resp.Signals[2].Key})
		require.Equal(t, []int{1, 1, 1}, []int{resp.Signals[0].Attempt, resp.Signals[1].Attempt, resp.Signals[2].Attempt})
	})

	t.Run("TermNameResolvesSignalKey", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Scope:    workflowTaskSignalScopeEvidence,
			TaskName: fixture.taskName,
			TermName: "approval_received",
		})
		require.NoError(t, err)
		require.Equal(t, workflowTaskSignalScopeEvidence, resp.Scope)
		require.Len(t, resp.Signals, 2)
		require.Equal(t, []int64{fixture.secondSignal.ID, fixture.firstSignal.ID}, []int64{resp.Signals[0].ID, resp.Signals[1].ID})
		require.Equal(t, []string{"approval", "approval"}, []string{resp.Signals[0].Key, resp.Signals[1].Key})
	})

	t.Run("RejectsKeyAndTermNameTogether", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "approval",
			TaskName: fixture.taskName,
			TermName: "approval_received",
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "mutually exclusive")
	})

	t.Run("RejectsInvalidScope", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Scope:    "everything",
			TaskName: fixture.taskName,
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "scope")
	})

	t.Run("RejectsUnknownTermName", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			TaskName: fixture.taskName,
			TermName: "missing_term",
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("RejectsNonSignalTermName", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			TaskName: fixture.timerOnlyTaskName,
			TermName: "review_timeout",
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not signal")
	})

	t.Run("EvidenceScopeWithoutEvidenceReturnsBadRequest", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Scope:    workflowTaskSignalScopeEvidence,
			TaskName: fixture.unresolvedTaskName,
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Wait evidence is unavailable")
	})

	t.Run("WithoutKeyPaginationIsOrderedAcrossDeclaredSignalKeys", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)
		limit := 2

		firstPage, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Limit:    &limit,
			Scope:    workflowTaskSignalScopeHistory,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.True(t, firstPage.HasMore)
		require.NotNil(t, firstPage.NextCursorID)
		require.Len(t, firstPage.Signals, 2)
		require.Equal(t,
			[]int64{fixture.thirdSignal.ID, fixture.escalationSignal.ID},
			[]int64{firstPage.Signals[0].ID, firstPage.Signals[1].ID},
		)

		secondPage, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			CursorID: firstPage.NextCursorID,
			ID:       fixture.workflowID,
			Limit:    &limit,
			Scope:    workflowTaskSignalScopeHistory,
			TaskName: fixture.taskName,
		})
		require.NoError(t, err)
		require.False(t, secondPage.HasMore)
		require.Len(t, secondPage.Signals, 2)
		require.Equal(t,
			[]int64{fixture.secondSignal.ID, fixture.firstSignal.ID},
			[]int64{secondPage.Signals[0].ID, secondPage.Signals[1].ID},
		)
	})

	t.Run("UnknownWorkflowReturnsNotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       "missing-workflow",
			TaskName: "await/review",
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Workflow not found")
	})

	t.Run("UnknownTaskReturnsNotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			TaskName: "missing/task",
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unknown task")
	})

	t.Run("UndeclaredKeyReturnsBadRequest", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			Key:      "missing_key",
			TaskName: fixture.taskName,
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not declared")
	})

	t.Run("TaskWithNoDeclaredSignalKeysReturnsBadRequest", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowTaskSignalsEndpoint)
		fixture := setupWorkflowTaskSignalsFixture(ctx, t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowTaskSignalsRequest{
			ID:       fixture.workflowID,
			TaskName: fixture.timerOnlyTaskName,
		})
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "declares no signal keys")
	})
}

func TestWorkflowTaskSignalsRequestExtractRaw(t *testing.T) {
	t.Parallel()

	t.Run("ParsesAndCapsLimit", func(t *testing.T) {
		t.Parallel()

		req := &workflowTaskSignalsRequest{}
		httpReq := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/pro/workflows/wf/task-signals?task_name=await%2Freview&key=approval&cursor_id=42&desc=false&limit=200&scope=history&workflow_attempt=2", nil)
		httpReq.SetPathValue("id", "wf")

		err := req.ExtractRaw(httpReq)
		require.NoError(t, err)
		require.Equal(t, "wf", req.ID)
		require.Equal(t, "await/review", req.TaskName)
		require.Equal(t, "approval", req.Key)
		require.NotNil(t, req.CursorID)
		require.Equal(t, int64(42), *req.CursorID)
		require.NotNil(t, req.Desc)
		require.False(t, *req.Desc)
		require.NotNil(t, req.Limit)
		require.Equal(t, 200, *req.Limit)
		require.Equal(t, workflowTaskSignalScopeHistory, req.Scope)
		require.NotNil(t, req.WorkflowAttempt)
		require.Equal(t, 2, *req.WorkflowAttempt)
	})

	t.Run("ReturnsBadRequestForInvalidQueryValues", func(t *testing.T) {
		t.Parallel()

		testCases := []struct {
			name string
			url  string
		}{
			{name: "CursorID", url: "/api/pro/workflows/wf/task-signals?task_name=await_review&cursor_id=nope"},
			{name: "Desc", url: "/api/pro/workflows/wf/task-signals?task_name=await_review&desc=nope"},
			{name: "Limit", url: "/api/pro/workflows/wf/task-signals?task_name=await_review&limit=nope"},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				t.Parallel()

				req := &workflowTaskSignalsRequest{}
				httpReq := httptest.NewRequestWithContext(t.Context(), http.MethodGet, testCase.url, nil)
				httpReq.SetPathValue("id", "wf")

				err := req.ExtractRaw(httpReq)
				require.Error(t, err)
			})
		}
	})
}

func TestProAPIHandlerWorkflowRetry(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessDefaultAll", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowRetryEndpoint)

		job1 := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_all_1", "task1", nil),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		job2 := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_all_1", "task2", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		job3 := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_all_1", "task3", []string{"task1", "task2"}),
			State:       ptrutil.Ptr(rivertype.JobStateCancelled),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowRetryRequest{ID: "wf_all_1"})
		require.NoError(t, err)

		require.Len(t, resp.RetriedJobs, 3)
		require.Equal(t, []int64{job1.ID, job2.ID, job3.ID}, []int64{resp.RetriedJobs[0].ID, resp.RetriedJobs[1].ID, resp.RetriedJobs[2].ID})
	})

	t.Run("ModeFailedOnly", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowRetryEndpoint)

		// Build jobs with specific states
		jobCompleted := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_only", "done", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		jobDiscarded := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_only", "failed", nil),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		_ = jobCompleted

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowRetryRequest{ID: "wf_failed_only", Mode: "failed_only"})
		require.NoError(t, err)

		require.Len(t, resp.RetriedJobs, 1)
		require.Equal(t, jobDiscarded.ID, resp.RetriedJobs[0].ID)
	})

	t.Run("ModeFailedAndDownstream", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowRetryEndpoint)

		// a -> b -> c; mark a as discarded, others completed
		jobA := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_downstream", "a", nil),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		jobB := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_downstream", "b", []string{"a"}),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		jobC := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_downstream", "c", []string{"b"}),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowRetryRequest{ID: "wf_failed_downstream", Mode: "failed_and_downstream"})
		require.NoError(t, err)

		require.Len(t, resp.RetriedJobs, 3)
		require.Equal(t, []int64{jobA.ID, jobB.ID, jobC.ID}, []int64{resp.RetriedJobs[0].ID, resp.RetriedJobs[1].ID, resp.RetriedJobs[2].ID})
	})

	t.Run("ResetHistoryBehavior", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowRetryEndpoint)

		attempt := 2
		maxAttempts := 5
		job := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			Attempt:     &attempt,
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_reset_history", "t1", nil),
			MaxAttempts: func() *int { v := maxAttempts; return &v }(),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})

		// Without resetting history, Attempt stays the same and MaxAttempts increments by 1
		respNoReset, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowRetryRequest{ID: "wf_reset_history", ResetHistory: false})
		require.NoError(t, err)
		require.Len(t, respNoReset.RetriedJobs, 1)
		require.Equal(t, job.ID, respNoReset.RetriedJobs[0].ID)
		require.Equal(t, attempt, respNoReset.RetriedJobs[0].Attempt)
		require.Equal(t, maxAttempts+1, respNoReset.RetriedJobs[0].MaxAttempts)

		// With resetting history, Attempt resets to 0 and MaxAttempts does not increment beyond the previous +1 action
		// Create a fresh workflow to isolate effects
		attempt2 := 3
		job2 := jobWithSchema(ctx, t, bundle.exec, bundle.schema, &testfactory.JobOpts{
			Attempt:     &attempt2,
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_reset_history2", "t1", nil),
			MaxAttempts: func() *int { v := maxAttempts; return &v }(),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})

		respReset, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowRetryRequest{ID: "wf_reset_history2", ResetHistory: true})
		require.NoError(t, err)
		require.Len(t, respReset.RetriedJobs, 1)
		require.Equal(t, job2.ID, respReset.RetriedJobs[0].ID)
		require.Equal(t, 0, respReset.RetriedJobs[0].Attempt)
		require.Equal(t, maxAttempts, respReset.RetriedJobs[0].MaxAttempts)
	})
}

func makeWorkflowJob(ctx context.Context, t *testing.T, exec riverdriver.Executor, schema string, workflowID string, taskName string, deps []string) *rivertype.JobRow {
	t.Helper()

	return jobWithSchema(ctx, t, exec, schema, &testfactory.JobOpts{
		Metadata: workflowMetadata(workflowID, taskName, deps),
	})
}

func jobWithSchema(ctx context.Context, t *testing.T, exec riverdriver.Executor, schema string, opts *testfactory.JobOpts) *rivertype.JobRow {
	t.Helper()

	params := testfactory.Job_Build(t, opts)
	params.Schema = schema

	job, err := exec.JobInsertFull(ctx, params)
	require.NoError(t, err)
	return job
}

func dropWorkflowV2Tables(ctx context.Context, t *testing.T, bundle *setupEndpointTestBundle) {
	t.Helper()

	for _, table := range WorkflowV2TableNames {
		qualifiedTable := pgx.Identifier{bundle.schema, table}.Sanitize()
		err := bundle.exec.Exec(ctx, "DROP TABLE IF EXISTS "+qualifiedTable+" CASCADE")
		require.NoError(t, err)
	}
}

func workflowMetadata(workflowID, taskName string, deps []string) []byte {
	if deps == nil {
		deps = []string{}
	}

	meta := map[string]any{
		"workflow_id": workflowID,
		"task":        taskName,
		"deps":        deps,
	}

	buf, err := json.Marshal(meta)
	if err != nil {
		panic(err)
	}
	return buf
}

func workflowMetadataWithWait(workflowID, taskName string, deps []string, wait *riverworkflow.WaitSpec, waitState map[string]any) []byte {
	if deps == nil {
		deps = []string{}
	}

	meta := map[string]any{
		"workflow_id": workflowID,
		"task":        taskName,
		"deps":        deps,
	}
	if wait != nil {
		meta["river:workflow_wait"] = persistedWaitSpec(wait)
	}
	if waitState != nil {
		meta["river:workflow_wait_state"] = waitState
	}

	buf, err := json.Marshal(meta)
	if err != nil {
		panic(err)
	}
	return buf
}

func persistedWaitSpec(wait *riverworkflow.WaitSpec) map[string]any {
	if wait == nil {
		return nil
	}

	raw, err := json.Marshal(wait)
	if err != nil {
		panic(err)
	}

	var persisted map[string]any
	if err := json.Unmarshal(raw, &persisted); err != nil {
		panic(err)
	}

	return persisted
}

type workflowTaskSignalsFixture struct {
	escalationSignal   *riverpro.WorkflowSignalResult
	firstSignal        *riverpro.WorkflowSignalResult
	secondSignal       *riverpro.WorkflowSignalResult
	taskName           string
	thirdSignal        *riverpro.WorkflowSignalResult
	timerOnlyTaskName  string
	unresolvedTaskName string
	workflowID         string
}

func setupWorkflowTaskSignalsFixture(ctx context.Context, t *testing.T, bundle *setupEndpointTestBundle) *workflowTaskSignalsFixture {
	t.Helper()

	workflowID := "wf_task_signals_" + time.Now().UTC().Format("150405.000000000")

	waitSpec := &riverworkflow.WaitSpec{
		Expr: "approval_received || escalation_received",
		Terms: []riverworkflow.WaitTermSpec{
			riverworkflow.WaitTermSignal("approval_received", "approval", "true").Label("Approval received"),
			riverworkflow.WaitTermSignal("escalation_received", "escalation", "true").Label("Escalation received"),
		},
	}

	taskName := "await/review"
	timerOnlyTaskName := "timer/only"
	unresolvedTaskName := "await/unresolved"
	workflow := bundle.client.NewWorkflow(&riverpro.WorkflowOpts{
		ID:   workflowID,
		Name: "wf_task_signals",
	})
	workflow.Add("collect_inputs", uicommontest.NoOpArgs{Name: "collect"}, nil, nil)
	workflow.Add(taskName, uicommontest.NoOpArgs{Name: "gated"}, nil, &riverpro.WorkflowTaskOpts{
		Deps: []string{"collect_inputs"},
		Wait: waitSpec,
	})
	workflow.Add(unresolvedTaskName, uicommontest.NoOpArgs{Name: "unresolved"}, nil, &riverpro.WorkflowTaskOpts{
		Deps: []string{"collect_inputs"},
		Wait: waitSpec,
	})
	workflow.Add(timerOnlyTaskName, uicommontest.NoOpArgs{Name: "timer"}, nil, &riverpro.WorkflowTaskOpts{
		Deps: []string{"collect_inputs"},
		Wait: &riverworkflow.WaitSpec{
			Expr: "review_timeout",
			Terms: []riverworkflow.WaitTermSpec{
				riverworkflow.WaitTermTimer(riverworkflow.TimerAfterWorkflowCreated("review_timeout", 5*time.Minute)),
			},
		},
	})

	result, err := workflow.Prepare(ctx)
	require.NoError(t, err)
	_, err = bundle.client.InsertMany(ctx, result.Jobs)
	require.NoError(t, err)

	require.NoError(t, bundle.exec.WorkflowInsertMany(ctx, &driver.WorkflowInsertManyParams{
		IDs:    []string{workflowID},
		Names:  []string{"wf_task_signals"},
		Schema: bundle.schema,
	}))
	workflowTable := pgx.Identifier{bundle.schema, "river_workflow"}.Sanitize()
	jobsTable := pgx.Identifier{bundle.schema, "river_job"}.Sanitize()

	err = bundle.exec.Exec(ctx, "UPDATE "+workflowTable+" SET current_attempt = 1 WHERE id = $1", workflowID)
	require.NoError(t, err)

	var waitingJobID int64
	err = bundle.exec.QueryRow(ctx, `
		SELECT id
		FROM `+jobsTable+`
		WHERE metadata->>'workflow_id' = $1
			AND metadata->>'task' = $2
	`, workflowID, taskName).Scan(&waitingJobID)
	require.NoError(t, err)

	firstSignal, err := workflow.Signal(ctx, "approval", map[string]any{"approved_by": "lead"}, &riverpro.WorkflowSignalOpts{
		Source: map[string]any{"actor": "lead", "kind": "ui"},
	})
	require.NoError(t, err)

	secondSignal, err := workflow.Signal(ctx, "approval", map[string]any{"approved_by": "manager"}, &riverpro.WorkflowSignalOpts{
		Source: map[string]any{"actor": "manager", "kind": "ui"},
	})
	require.NoError(t, err)

	escalationSignal, err := workflow.Signal(ctx, "escalation", map[string]any{"escalated_to": "team_lead"}, &riverpro.WorkflowSignalOpts{
		Source: map[string]any{"actor": "scheduler", "kind": "automation"},
	})
	require.NoError(t, err)

	resultTime := time.Now().UTC().Add(-2 * time.Minute)
	metadata := workflowMetadataWithWait(workflowID, taskName, nil, waitSpec, map[string]any{
		"started_at":  time.Now().UTC().Add(-10 * time.Minute).Format(time.RFC3339Nano),
		"resolved_at": resultTime.Format(time.RFC3339Nano),
		"result": map[string]any{
			"as_of":   resultTime.Format(time.RFC3339Nano),
			"attempt": 1,
			"summary": "Approval received",
			"signals": map[string]any{
				"approval": map[string]any{
					"included_count":   2,
					"last_included_id": secondSignal.ID,
				},
				"escalation": map[string]any{
					"included_count":   1,
					"last_included_id": escalationSignal.ID,
				},
			},
			"terms": []map[string]any{{
				"kind":            "signal",
				"label":           "Approval received",
				"last_matched_id": secondSignal.ID,
				"matched_count":   2,
				"name":            "approval_received",
				"required_count":  1,
				"satisfied":       true,
				"signal_key":      "approval",
			}, {
				"kind":            "signal",
				"label":           "Escalation received",
				"last_matched_id": escalationSignal.ID,
				"matched_count":   1,
				"name":            "escalation_received",
				"required_count":  1,
				"satisfied":       true,
				"signal_key":      "escalation",
			}},
			"timers": map[string]any{},
		},
	})
	err = bundle.exec.Exec(ctx, `
		UPDATE `+jobsTable+`
		SET metadata = jsonb_set(metadata, '{river:workflow_wait_state}', $1::jsonb, true)
		WHERE id = $2
	`, metadataFieldRaw(t, metadata, "river:workflow_wait_state"), waitingJobID)
	require.NoError(t, err)

	thirdSignal, err := workflow.Signal(ctx, "approval", map[string]any{"approved_by": "director"}, &riverpro.WorkflowSignalOpts{
		Source: map[string]any{"actor": "director", "kind": "ui"},
	})
	require.NoError(t, err)

	return &workflowTaskSignalsFixture{
		escalationSignal:   escalationSignal,
		firstSignal:        firstSignal,
		secondSignal:       secondSignal,
		taskName:           taskName,
		thirdSignal:        thirdSignal,
		timerOnlyTaskName:  timerOnlyTaskName,
		unresolvedTaskName: unresolvedTaskName,
		workflowID:         workflowID,
	}
}

func signalApprovalOnAttempt(ctx context.Context, t *testing.T, bundle *setupEndpointTestBundle, workflowID string, attempt int) *riverpro.WorkflowSignalResult {
	t.Helper()

	workflowTable := pgx.Identifier{bundle.schema, "river_workflow"}.Sanitize()
	err := bundle.exec.Exec(ctx, "UPDATE "+workflowTable+" SET current_attempt = $1 WHERE id = $2", attempt, workflowID)
	require.NoError(t, err)

	workflow, err := bundle.client.WorkflowFromExistingID(ctx, workflowID, nil)
	require.NoError(t, err)

	signal, err := workflow.Signal(ctx, "approval", map[string]any{"approved_by": "retry"}, &riverpro.WorkflowSignalOpts{
		Attempt: &attempt,
		Source:  map[string]any{"actor": "retry", "kind": "ui"},
	})
	require.NoError(t, err)

	return signal
}

func metadataFieldRaw(t *testing.T, metadata []byte, key string) []byte {
	t.Helper()

	var values map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(metadata, &values))

	value, ok := values[key]
	require.True(t, ok)

	return value
}
