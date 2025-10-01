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

	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/riverproui/internal/protestfactory"
)

type setupEndpointTestBundle struct {
	client *riverpro.Client[pgx.Tx]
	exec   driver.ProExecutorTx
	logger *slog.Logger
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle ProAPIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger = riversharedtest.Logger(t)
		driver = riverpropgxv5.New(riversharedtest.DBPool(ctx, t))
		tx, _  = riverdbtest.TestTxPgxDriver(ctx, t, driver, nil)
		exec   = driver.UnwrapProExecutor(tx)
	)

	client, err := riverpro.NewClient(driver, &riverpro.Config{
		Config: river.Config{
			Logger: logger,
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
		logger: logger,
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

		job1 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task", nil)
		job2 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task", []string{"dep1"})
		job3 := makeWorkflowJob(ctx, t, bundle.exec, "123", "task", []string{"dep1", "dep2"})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowCancelRequest{ID: "123"})
		require.NoError(t, err)

		require.Len(t, resp.CancelledJobs, 3)
		require.Equal(t, []int64{job1.ID, job2.ID, job3.ID}, []int64{resp.CancelledJobs[0].ID, resp.CancelledJobs[1].ID, resp.CancelledJobs[2].ID})
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

func workflowMetadata(workflowID, taskName string, deps []string) []byte {
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
