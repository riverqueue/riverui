package riverui

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"
	"github.com/riverqueue/riverui/internal/apierror"
	"github.com/riverqueue/riverui/internal/riverinternaltest"
	"github.com/riverqueue/riverui/internal/riverinternaltest/testfactory"
	"github.com/riverqueue/riverui/internal/util/ptrutil"
)

type setupEndpointTestBundle struct {
	client *river.Client[pgx.Tx]
	exec   riverdriver.ExecutorTx
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		endpoint       TEndpoint
		logger         = riverinternaltest.Logger(t)
		client, driver = insertOnlyClient(t, logger)
		tx             = riverinternaltest.TestTx(ctx, t)
	)

	if withSetBundle, ok := any(&endpoint).(withSetBundle); ok {
		withSetBundle.SetBundle(&apiBundle{
			client: client,
			dbPool: tx,
			logger: logger,
		})
	}

	return &endpoint, &setupEndpointTestBundle{
		client: client,
		exec:   driver.UnwrapExecutor(tx),
		tx:     tx,
	}
}

func TestHandlerHealthCheckGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("CompleteSuccess", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[healthCheckGetEndpoint](ctx, t)

		resp, err := endpoint.Execute(ctx, &healthCheckGetRequest{Name: healthCheckNameComplete})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("CompleteDatabaseError", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[healthCheckGetEndpoint](ctx, t)

		// Roll back prematurely so we get a database error.
		require.NoError(t, bundle.tx.Rollback(ctx))

		_, err := endpoint.Execute(ctx, &healthCheckGetRequest{Name: healthCheckNameComplete})
		requireAPIError(t, apierror.WithInternalError(
			apierror.NewServiceUnavailable("Unable to query database. Check logs for details."),
			pgx.ErrTxClosed,
		), err)
	})

	t.Run("Minimal", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[healthCheckGetEndpoint](ctx, t)

		resp, err := endpoint.Execute(ctx, &healthCheckGetRequest{Name: healthCheckNameMinimal})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[healthCheckGetEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &healthCheckGetRequest{Name: "other"})
		requireAPIError(t, apierror.NewNotFound("Health check %q not found. Use either `complete` or `minimal`.", "other"), err)
	})
}

func TestJobCancelEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobCancelEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := endpoint.Execute(ctx, &jobCancelRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		updatedJob1, err := bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateCancelled, updatedJob1.State)

		updatedJob2, err := bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateCancelled, updatedJob2.State)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[jobCancelEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &jobCancelRequest{JobIDs: []int64String{123}})
		requireAPIError(t, apierror.NewNotFoundJob(123), err)
	})
}

func TestJobDeleteEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobDeleteEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := endpoint.Execute(ctx, &jobDeleteRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[jobDeleteEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &jobDeleteRequest{JobIDs: []int64String{123}})
		requireAPIError(t, apierror.NewNotFoundJob(123), err)
	})
}

func TestJobGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobGetEndpoint](ctx, t)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := endpoint.Execute(ctx, &jobGetRequest{JobID: job.ID})
		require.NoError(t, err)
		require.Equal(t, job.ID, resp.ID)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[jobGetEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &jobGetRequest{JobID: 123})
		requireAPIError(t, apierror.NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobListEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})

		// Defaults to filtering to running jobs; other states are excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateDiscarded), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStatePending)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})

		resp, err := endpoint.Execute(ctx, &jobListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobListEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := endpoint.Execute(ctx, &jobListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job1.ID, resp.Data[0].ID)
	})

	t.Run("FiltersFinalizedStatesAndOrdersDescending", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobListEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})

		// Other states excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})

		resp, err := endpoint.Execute(ctx, &jobListRequest{State: ptrutil.Ptr(rivertype.JobStateCompleted)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job2.ID, resp.Data[0].ID) // order inverted
		require.Equal(t, job1.ID, resp.Data[1].ID)
	})

	t.Run("FiltersNonFinalizedStates", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobListEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		// Other states excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})

		resp, err := endpoint.Execute(ctx, &jobListRequest{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})
}

func TestJobRetryEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobRetryEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})

		resp, err := endpoint.Execute(ctx, &jobRetryRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		updatedJob1, err := bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateAvailable, updatedJob1.State)

		updatedJob2, err := bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateAvailable, updatedJob2.State)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[jobRetryEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &jobRetryRequest{JobIDs: []int64String{123}})
		requireAPIError(t, apierror.NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerQueueGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[queueGetEndpoint](ctx, t)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		_, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, &river.InsertOpts{Queue: queue.Name})
		require.NoError(t, err)

		resp, err := endpoint.Execute(ctx, &queueGetRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, 1, resp.CountAvailable)
		require.Equal(t, queue.Name, resp.Name)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[queueGetEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &queueGetRequest{Name: "does_not_exist"})
		requireAPIError(t, apierror.NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[queueListEndpoint](ctx, t)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		queue2 := testfactory.Queue(ctx, t, bundle.exec, nil)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue1.Name})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue2.Name})

		resp, err := endpoint.Execute(ctx, &queueListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, 1, resp.Data[0].CountAvailable)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
		require.Equal(t, 1, resp.Data[1].CountAvailable)
		require.Equal(t, queue2.Name, resp.Data[1].Name)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[queueListEndpoint](ctx, t)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		_ = testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := endpoint.Execute(ctx, &queueListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
	})
}

func TestAPIHandlerQueuePause(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[queuePauseEndpoint](ctx, t)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := endpoint.Execute(ctx, &queuePauseRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[queuePauseEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &queuePauseRequest{Name: "does_not_exist"})
		requireAPIError(t, apierror.NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueResume(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[queueResumeEndpoint](ctx, t)

		queue := testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{
			PausedAt: ptrutil.Ptr(time.Now()),
		})

		resp, err := endpoint.Execute(ctx, &queueResumeRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[queueResumeEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &queueResumeRequest{Name: "does_not_exist"})
		requireAPIError(t, apierror.NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestStateAndCountGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[stateAndCountGetEndpoint](ctx, t)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})

		for range 2 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 3 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 4 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateDiscarded), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 5 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStatePending)})
		}

		for range 6 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRetryable)})
		}

		for range 7 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		}

		for range 8 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})
		}

		resp, err := endpoint.Execute(ctx, &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &stateAndCountGetResponse{
			Available: 1,
			Cancelled: 2,
			Completed: 3,
			Discarded: 4,
			Pending:   5,
			Retryable: 6,
			Running:   7,
			Scheduled: 8,
		}, resp)
	})
}

func TestAPIHandlerWorkflowGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[workflowGetEndpoint](ctx, t)

		workflowID := uuid.New()
		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})

		resp, err := endpoint.Execute(ctx, &workflowGetRequest{ID: workflowID.String()})
		require.NoError(t, err)
		require.Len(t, resp.Tasks, 2)
		require.Equal(t, job1.ID, resp.Tasks[0].ID)
		require.Equal(t, job2.ID, resp.Tasks[1].ID)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[workflowGetEndpoint](ctx, t)

		workflowID := uuid.New()

		_, err := endpoint.Execute(ctx, &workflowGetRequest{ID: workflowID.String()})
		requireAPIError(t, apierror.NewNotFoundWorkflow(workflowID.String()), err)
	})
}

func TestAPIHandlerWorkflowList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[workflowListEndpoint](ctx, t)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Metadata: []byte(`{"workflow_id":"1", "workflow_name":"first_wf", "task":"a"}`),
			State:    ptrutil.Ptr(rivertype.JobStatePending),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    []byte(`{"workflow_id":"2", "task":"b"}`),
			State:       ptrutil.Ptr(rivertype.JobStateCompleted),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			Metadata:    []byte(`{"workflow_id":"2", "task":"c", "workflow_deps_failed_at":"2024-01-01T00:00:00Z"}`),
			State:       ptrutil.Ptr(rivertype.JobStateCancelled),
		})

		t.Run("All", func(t *testing.T) {
			resp, err := endpoint.Execute(ctx, &workflowListRequest{})
			require.NoError(t, err)
			require.Len(t, resp.Data, 2)
			require.Equal(t, 1, resp.Data[0].CountCancelled)
			require.Equal(t, 1, resp.Data[0].CountCompleted)
			t.Logf("resp0: %+v", resp.Data[0])
			require.Equal(t, 1, resp.Data[0].CountFailedDeps)
			require.Nil(t, resp.Data[0].Name)

			require.Equal(t, 0, resp.Data[1].CountAvailable)
			require.Equal(t, 0, resp.Data[1].CountCancelled)
			require.Equal(t, 0, resp.Data[1].CountCompleted)
			require.Equal(t, 0, resp.Data[1].CountDiscarded)
			require.Equal(t, 0, resp.Data[1].CountFailedDeps)
			require.Equal(t, 1, resp.Data[1].CountPending)
			require.Equal(t, 0, resp.Data[1].CountRetryable)
			require.Equal(t, 0, resp.Data[1].CountRunning)
			require.Equal(t, 0, resp.Data[1].CountScheduled)
			require.Equal(t, "first_wf", *resp.Data[1].Name)
		})

		t.Run("Active", func(t *testing.T) {
			resp, err := endpoint.Execute(ctx, &workflowListRequest{State: "active"})
			require.NoError(t, err)
			require.Len(t, resp.Data, 1)
			require.Equal(t, 0, resp.Data[0].CountAvailable)
			require.Equal(t, 0, resp.Data[0].CountCancelled)
			require.Equal(t, 0, resp.Data[0].CountCompleted)
			require.Equal(t, 0, resp.Data[0].CountDiscarded)
			require.Equal(t, 0, resp.Data[0].CountFailedDeps)
			require.Equal(t, 1, resp.Data[0].CountPending)
			require.Equal(t, 0, resp.Data[0].CountRetryable)
			require.Equal(t, 0, resp.Data[0].CountRunning)
			require.Equal(t, 0, resp.Data[0].CountScheduled)
			require.Equal(t, "first_wf", *resp.Data[0].Name)
			require.Equal(t, job1.CreatedAt.UTC(), resp.Data[0].CreatedAt)
		})

		t.Run("Inactive", func(t *testing.T) {
			resp, err := endpoint.Execute(ctx, &workflowListRequest{State: "inactive"})
			require.NoError(t, err)
			require.Len(t, resp.Data, 1)
			require.Equal(t, 1, resp.Data[0].CountCompleted)
			require.Equal(t, 1, resp.Data[0].CountFailedDeps)
			require.Nil(t, resp.Data[0].Name)
			require.Equal(t, job2.CreatedAt.UTC(), resp.Data[0].CreatedAt)
		})
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[workflowListEndpoint](ctx, t)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Metadata: []byte(`{"workflow_id":"1", "workflow_name":"first_wf", "task":"a"}`),
			State:    ptrutil.Ptr(rivertype.JobStatePending),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Metadata:    []byte(`{"workflow_id":"2", "task":"b"}`),
			ScheduledAt: ptrutil.Ptr(time.Now().Add(time.Hour)),
			State:       ptrutil.Ptr(rivertype.JobStateScheduled),
		})

		resp, err := endpoint.Execute(ctx, &workflowListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, "2", resp.Data[0].ID) // DESC order means last one gets returned
	})
}
