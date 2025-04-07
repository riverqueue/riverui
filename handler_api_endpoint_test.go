package riverui

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/riversharedtest"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

type setupEndpointTestBundle struct {
	client *river.Client[pgx.Tx]
	exec   riverdriver.ExecutorTx
	logger *slog.Logger
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(apiBundle apiBundle) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger         = riverinternaltest.Logger(t)
		client, driver = insertOnlyClient(t, logger)
		tx             = riverinternaltest.TestTx(ctx, t)
	)

	endpoint := initFunc(apiBundle{
		archetype: riversharedtest.BaseServiceArchetype(t),
		client:    client,
		dbPool:    tx,
		logger:    logger,
	})

	if service, ok := any(endpoint).(startstop.Service); ok {
		require.NoError(t, service.Start(ctx))
		t.Cleanup(service.Stop)
	}

	return endpoint, &setupEndpointTestBundle{
		client: client,
		exec:   driver.UnwrapExecutor(tx),
		logger: logger,
		tx:     tx,
	}
}

func testMountOpts(t *testing.T) *apiendpoint.MountOpts {
	t.Helper()
	return &apiendpoint.MountOpts{
		Logger:    riverinternaltest.Logger(t),
		Validator: apitype.NewValidator(),
	}
}

func TestAPIHandlerFeaturesGet(t *testing.T) { //nolint:paralleltest
	// This can't be parallelized because it tries to make DB schema changes.
	ctx := context.Background()

	t.Run("SuccessWithEverythingFalse", func(t *testing.T) { //nolint:paralleltest
		// This can't be parallelized because it tries to make DB schema changes.
		endpoint, bundle := setupEndpoint(ctx, t, newFeaturesGetEndpoint)

		_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_producer;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_client CASCADE;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_list_active;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_scheduling;`)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &featuresGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &featuresGetResponse{
			HasClientTable:   false,
			HasProducerTable: false,
			HasWorkflows:     false,
		}, resp)
	})

	t.Run("SuccessWithEverythingTrue", func(t *testing.T) { //nolint:paralleltest
		// This can't be parallelized because it tries to make DB schema changes.
		endpoint, bundle := setupEndpoint(ctx, t, newFeaturesGetEndpoint)

		_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_client (id SERIAL PRIMARY KEY);`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_producer (id SERIAL PRIMARY KEY);`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS river_job_workflow_list_active ON river_job ((metadata->>'workflow_id'));`)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &featuresGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &featuresGetResponse{
			HasClientTable:   true,
			HasProducerTable: true,
			HasWorkflows:     true,
		}, resp)
	})
}

func TestAPIHandlerHealthCheckGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("CompleteSuccess", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameComplete})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("CompleteDatabaseError", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		// Roll back prematurely so we get a database error.
		require.NoError(t, bundle.tx.Rollback(ctx))

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameComplete})
		requireAPIError(t, apierror.WithInternalError(
			apierror.NewServiceUnavailable("Unable to query database. Check logs for details."),
			pgx.ErrTxClosed,
		), err)
	})

	t.Run("Minimal", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameMinimal})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: "other"})
		requireAPIError(t, apierror.NewNotFoundf("Health check %q not found. Use either `complete` or `minimal`.", "other"), err)
	})
}

func TestAPIHandlerJobCancel(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobCancelEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobCancelRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
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

		endpoint, _ := setupEndpoint(ctx, t, newJobCancelEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobCancelRequest{JobIDs: []int64String{123}})
		requireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobDelete(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobDeleteEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobDeleteRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobDeleteEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobDeleteRequest{JobIDs: []int64String{123}})
		requireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobGetEndpoint)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobGetRequest{JobID: job.ID})
		require.NoError(t, err)
		require.Equal(t, job.ID, resp.ID)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobGetRequest{JobID: 123})
		requireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})

		// Defaults to filtering to running jobs; other states are excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateDiscarded), FinalizedAt: ptrutil.Ptr(time.Now())})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStatePending)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job1.ID, resp.Data[0].ID)
	})

	t.Run("FiltersFinalizedStatesAndOrdersDescending", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})

		// Other states excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{State: ptrutil.Ptr(rivertype.JobStateCompleted)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job2.ID, resp.Data[0].ID) // order inverted
		require.Equal(t, job1.ID, resp.Data[1].ID)
	})

	t.Run("FiltersNonFinalizedStates", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		// Other states excluded.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})
}

func TestAPIHandlerJobRetry(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobRetryEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobRetryRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
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

		endpoint, _ := setupEndpoint(ctx, t, newJobRetryEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobRetryRequest{JobIDs: []int64String{123}})
		requireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerProducerList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newProducerListEndpoint)

		_, err := bundle.tx.Exec(ctx, producerSchema)
		require.NoError(t, err)

		_, err = bundle.tx.Exec(ctx, `INSERT INTO river_producer (client_id, queue_name, max_workers, metadata) VALUES ('client1', 'queue1', 1, '{}');`)
		require.NoError(t, err)

		_, err = bundle.tx.Exec(ctx, `INSERT INTO river_producer (client_id, queue_name, max_workers, metadata) VALUES ('client2', 'queue1', 2, '{}');`)
		require.NoError(t, err)

		_, err = bundle.tx.Exec(ctx,
			`INSERT INTO river_producer (client_id, queue_name, max_workers, metadata) VALUES (
			'client2', 'queue2', 3, '{"concurrency": {"running": {"abcd": {"count": 3}, "efgh": {"count": 2}}}}'
			);`,
		)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &producerListRequest{QueueName: "queue1"})
		require.NoError(t, err)
		require.Equal(t, 2, len(resp.Data))
		require.Equal(t, "client1", resp.Data[0].ClientID)
		require.Equal(t, 1, resp.Data[0].MaxWorkers)
		require.Equal(t, int32(0), resp.Data[0].Running)
		require.Equal(t, "client2", resp.Data[1].ClientID)
		require.Equal(t, 2, resp.Data[1].MaxWorkers)
		require.Equal(t, int32(0), resp.Data[1].Running)

		resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &producerListRequest{QueueName: "queue2"})
		require.NoError(t, err)
		require.Equal(t, 1, len(resp.Data))
		require.Equal(t, "client2", resp.Data[0].ClientID)
		require.Equal(t, 3, resp.Data[0].MaxWorkers)
		require.Equal(t, int32(5), resp.Data[0].Running)

		resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &producerListRequest{QueueName: "queue3"})
		require.NoError(t, err)
		require.Equal(t, 0, len(resp.Data))
	})
}

func TestAPIHandlerQueueGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueGetEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		_, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, &river.InsertOpts{Queue: queue.Name})
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueGetRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, 1, resp.CountAvailable)
		require.Equal(t, queue.Name, resp.Name)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueueGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueGetRequest{Name: "does_not_exist"})
		requireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueListEndpoint)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		queue2 := testfactory.Queue(ctx, t, bundle.exec, nil)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue1.Name})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue2.Name})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, 1, resp.Data[0].CountAvailable)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
		require.Equal(t, 1, resp.Data[1].CountAvailable)
		require.Equal(t, queue2.Name, resp.Data[1].Name)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueListEndpoint)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		_ = testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueListRequest{Limit: ptrutil.Ptr(1)})
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

		endpoint, bundle := setupEndpoint(ctx, t, newQueuePauseEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queuePauseRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueuePauseEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queuePauseRequest{Name: "does_not_exist"})
		requireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueResume(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueResumeEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{
			PausedAt: ptrutil.Ptr(time.Now()),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueResumeRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueueResumeEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueResumeRequest{Name: "does_not_exist"})
		requireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestStateAndCountGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newStateAndCountGetEndpoint)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})

		for i := 0; i < 2; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for i := 0; i < 3; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for i := 0; i < 4; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateDiscarded), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for i := 0; i < 5; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStatePending)})
		}

		for i := 0; i < 6; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRetryable)})
		}

		for i := 0; i < 7; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		}

		for i := 0; i < 8; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
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

	t.Run("WithCachedQueryAboveSkipThreshold", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newStateAndCountGetEndpoint)

		const queryCacheSkipThreshold = 3
		for i := 0; i < queryCacheSkipThreshold+1; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}

		_, err := endpoint.queryCacher.RunQuery(ctx)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &stateAndCountGetResponse{
			Available: queryCacheSkipThreshold + 1,
		}, resp)
	})

	t.Run("WithCachedQueryBelowSkipThreshold", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newStateAndCountGetEndpoint)

		const queryCacheSkipThreshold = 3
		for i := 0; i < queryCacheSkipThreshold-1; i++ {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}

		_, err := endpoint.queryCacher.RunQuery(ctx)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &stateAndCountGetResponse{
			Available: queryCacheSkipThreshold - 1,
		}, resp)
	})
}

func TestAPIHandlerWorkflowGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newWorkflowGetEndpoint)

		workflowID := uuid.New()
		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowGetRequest{ID: workflowID.String()})
		require.NoError(t, err)
		require.Len(t, resp.Tasks, 2)
		require.Equal(t, job1.ID, resp.Tasks[0].ID)
		require.Equal(t, job2.ID, resp.Tasks[1].ID)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newWorkflowGetEndpoint)

		workflowID := uuid.New()

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowGetRequest{ID: workflowID.String()})
		requireAPIError(t, NewNotFoundWorkflow(workflowID.String()), err)
	})
}

func TestAPIHandlerWorkflowList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newWorkflowListEndpoint)

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
			resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowListRequest{})
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
			resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowListRequest{State: "active"})
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
			resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowListRequest{State: "inactive"})
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

		endpoint, bundle := setupEndpoint(ctx, t, newWorkflowListEndpoint)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Metadata: []byte(`{"workflow_id":"1", "workflow_name":"first_wf", "task":"a"}`),
			State:    ptrutil.Ptr(rivertype.JobStatePending),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Metadata:    []byte(`{"workflow_id":"2", "task":"b"}`),
			ScheduledAt: ptrutil.Ptr(time.Now().Add(time.Hour)),
			State:       ptrutil.Ptr(rivertype.JobStateScheduled),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &workflowListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, "2", resp.Data[0].ID) // DESC order means last one gets returned
	})
}
