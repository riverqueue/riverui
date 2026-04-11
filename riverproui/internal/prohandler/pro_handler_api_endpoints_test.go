package prohandler

import (
	"context"
	"encoding/json"
	"log/slog"
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
	"riverqueue.com/riverui/riverproui/internal/protestfactory"
)

type setupEndpointTestBundle struct {
	client *riverpro.Client[pgx.Tx]
	exec   driver.ProExecutorTx
	execDB driver.ProExecutor
	logger *slog.Logger
	schema string
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle ProAPIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger     = riversharedtest.Logger(t)
		driver     = riverpropgxv5.New(riversharedtest.DBPool(ctx, t))
		tx, schema = riverdbtest.TestTxPgxDriver(ctx, t, driver, nil)
		exec       = driver.UnwrapProExecutor(tx)
		execDB     = driver.GetProExecutor()
	)

	client, err := riverpro.NewClient(driver, &riverpro.Config{
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
			Driver:    driver,
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
		execDB: execDB,
		logger: logger,
		schema: schema,
		tx:     tx,
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

		job1 := protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{ID: ptrutil.Ptr("alpha"), NextRunAt: ptrutil.Ptr(time.Now().Add(time.Minute))})
		job2 := protestfactory.PeriodicJob(ctx, t, bundle.exec, &protestfactory.PeriodicJobOpts{ID: ptrutil.Ptr("beta"), NextRunAt: ptrutil.Ptr(time.Now().Add(2 * time.Minute))})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &periodicJobListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewPeriodicJobListEndpoint)

		job1 := protestfactory.PeriodicJob(ctx, t, bundle.exec, nil)
		_ = protestfactory.PeriodicJob(ctx, t, bundle.exec, nil)

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

		job1 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task_1", nil)
		job2 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task_2", []string{"task_1"})
		job3 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task_3", []string{"task_1", "task_2"})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowCancelRequest{ID: "123"})
		require.NoError(t, err)

		require.Len(t, resp.CancelledJobs, 3)
		require.Equal(t, []int64{job1.ID, job2.ID, job3.ID}, []int64{resp.CancelledJobs[0].ID, resp.CancelledJobs[1].ID, resp.CancelledJobs[2].ID})
	})
}

func TestProAPIHandlerWorkflowGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessIncludesGateAndWaitReason", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowGetEndpoint)
		require.NoError(t, bundle.execDB.WorkflowInsertMany(ctx, &driver.WorkflowInsertManyParams{
			IDs:    []string{"wf_get"},
			Names:  []string{"wf_get"},
			Schema: bundle.schema,
		}))

		now := time.Now().UTC().Truncate(time.Second)
		gateSpec := &riverworkflow.GateSpec{
			Expr:    `signals["approval"].size() > 0 || timers["review_sla"].fired`,
			Signals: []string{"approval"},
			Timers: []riverworkflow.Timer{
				riverworkflow.TimerAfterWorkflowCreated("review_sla", 30*time.Minute),
			},
		}

		dependencyJob := jobWithSchema(ctx, t, bundle.execDB, bundle.schema, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(now.Add(-2 * time.Minute)),
			Metadata:    workflowMetadata("wf_get", "collect_inputs", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})

		gatedJob := jobWithSchema(ctx, t, bundle.execDB, bundle.schema, &testfactory.JobOpts{
			Metadata: workflowMetadataWithGate("wf_get", "await_review", []string{"collect_inputs"}, gateSpec, map[string]any{
				"active_at": now.Format(time.RFC3339Nano),
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
		require.Nil(t, taskByID[dependencyJob.ID].Gate)

		gatedTask := taskByID[gatedJob.ID]
		require.NotNil(t, gatedTask)
		require.Equal(t, "await_review", gatedTask.Name)
		require.Equal(t, "wf_get", gatedTask.WorkflowID)
		require.Equal(t, []string{"collect_inputs"}, gatedTask.Deps)
		require.Equal(t, workflowTaskWaitReasonGate, gatedTask.WaitReason)
		require.NotNil(t, gatedTask.Gate)
		require.True(t, gatedTask.Gate.Enabled)
		require.Equal(t, "waiting", gatedTask.Gate.Phase)
		require.Equal(t, gateSpec.Expr, gatedTask.Gate.ExprCEL)
		require.Equal(t, []string{"approval"}, gatedTask.Gate.DeclaredSignals)
		require.Len(t, gatedTask.Gate.Timers, 1)
		require.NotNil(t, gatedTask.Gate.ActiveAt)
		require.Nil(t, gatedTask.Gate.Satisfaction)

		timer := gatedTask.Gate.Timers[0]
		require.Equal(t, "review_sla", timer.Name)
		require.NotEmpty(t, timer.After)
		require.NotNil(t, timer.AfterUS)
		require.True(t, timer.HasAfter)
		require.True(t, timer.HasFireAt)
		require.NotNil(t, timer.AfterSeconds)
		require.InDelta(t, 1800, *timer.AfterSeconds, 0.001)
		require.NotNil(t, timer.Anchor)
		require.Equal(t, string(riverworkflow.TimerAnchorKindWorkflowCreatedAt), timer.Anchor.Kind)
		require.NotNil(t, timer.FireAt)
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

func TestProAPIHandlerWorkflowRetry(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessDefaultAll", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewWorkflowRetryEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_all_1", "task1", nil),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_all_1", "task2", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		job3 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
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
		jobCompleted := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_only", "done", nil),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		jobDiscarded := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
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
		jobA := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_downstream", "a", nil),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		jobB := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    workflowMetadata("wf_failed_downstream", "b", []string{"a"}),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		jobC := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
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
		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
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
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
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

func makeWorkflowJob(ctx context.Context, t *testing.T, exec riverdriver.ExecutorTx, workflowID string, taskName string, deps []string) *rivertype.JobRow {
	t.Helper()

	return testfactory.Job(ctx, t, exec, &testfactory.JobOpts{
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

func workflowMetadataWithGate(workflowID, taskName string, deps []string, gate *riverworkflow.GateSpec, gateState map[string]any) []byte {
	if deps == nil {
		deps = []string{}
	}

	meta := map[string]any{
		"workflow_id": workflowID,
		"task":        taskName,
		"deps":        deps,
	}
	if gate != nil {
		meta["river:workflow_gate"] = gate
	}
	if gateState != nil {
		meta["river:workflow_gate_state"] = gateState
	}

	buf, err := json.Marshal(meta)
	if err != nil {
		panic(err)
	}
	return buf
}
