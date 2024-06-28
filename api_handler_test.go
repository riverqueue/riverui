package riverui

import (
	"context"
	"testing"
	"time"

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

		insertRes1, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, nil)
		require.NoError(t, err)

		insertRes2, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, nil)
		require.NoError(t, err)

		resp, err := endpoint.Execute(ctx, &jobCancelRequest{JobIDs: []int64String{int64String(insertRes1.Job.ID), int64String(insertRes2.Job.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		updatedJob1, err := bundle.client.JobGetTx(ctx, bundle.tx, insertRes1.Job.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateCancelled, updatedJob1.State)

		updatedJob2, err := bundle.client.JobGetTx(ctx, bundle.tx, insertRes2.Job.ID)
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

func TestJobGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint[jobGetEndpoint](ctx, t)

		insertRes, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, nil)
		require.NoError(t, err)

		resp, err := endpoint.Execute(ctx, &jobGetRequest{JobID: insertRes.Job.ID})
		require.NoError(t, err)
		require.Equal(t, insertRes.Job.ID, resp.ID)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint[jobGetEndpoint](ctx, t)

		_, err := endpoint.Execute(ctx, &jobGetRequest{JobID: 123})
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

		_, err := bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, &river.InsertOpts{Queue: queue1.Name})
		require.NoError(t, err)
		_, err = bundle.client.InsertTx(ctx, bundle.tx, &noOpArgs{}, &river.InsertOpts{Queue: queue2.Name})
		require.NoError(t, err)

		resp, err := endpoint.Execute(ctx, &queueListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, 1, resp.Data[0].CountAvailable)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
		require.Equal(t, 1, resp.Data[1].CountAvailable)
		require.Equal(t, queue2.Name, resp.Data[1].Name)
	})

	t.Run("limit", func(t *testing.T) {
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
