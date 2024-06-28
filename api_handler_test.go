package riverui

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
	"github.com/riverqueue/riverui/internal/apierror"
	"github.com/riverqueue/riverui/internal/riverinternaltest"
)

type setupEndpointTestBundle struct {
	client *river.Client[pgx.Tx]
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		endpoint TEndpoint
		logger   = riverinternaltest.Logger(t)
		client   = insertOnlyClient(t, logger)
		tx       = riverinternaltest.TestTx(ctx, t)
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
