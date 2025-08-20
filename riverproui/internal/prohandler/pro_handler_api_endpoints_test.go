package prohandler

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/riversharedtest"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver"
	"riverqueue.com/riverpro/driver/riverpropgxv5"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/uicommontest"
)

type setupEndpointTestBundle struct {
	client *riverpro.Client[pgx.Tx]
	exec   riverdriver.ExecutorTx
	logger *slog.Logger
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle ProAPIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger         = riverinternaltest.Logger(t)
		client, driver = insertOnlyClient(t, logger)
		tx             = riverinternaltest.TestTx(ctx, t)
		exec           = driver.UnwrapProExecutor(tx)
	)

	endpoint := initFunc(ProAPIBundle[pgx.Tx]{
		APIBundle: apibundle.APIBundle[pgx.Tx]{
			Archetype:  riversharedtest.BaseServiceArchetype(t),
			Client:     client.Client,
			DB:         exec,
			Driver:     driver,
			Extensions: map[string]bool{},
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

func insertOnlyClient(t *testing.T, logger *slog.Logger) (*riverpro.Client[pgx.Tx], driver.ProDriver[pgx.Tx]) {
	t.Helper()

	workers := river.NewWorkers()
	river.AddWorker(workers, &uicommontest.NoOpWorker{})

	driver := riverpropgxv5.New(nil)

	client, err := riverpro.NewClient(driver, &riverpro.Config{
		Config: river.Config{
			Logger:  logger,
			Workers: workers,
		},
	})
	require.NoError(t, err)

	return client, driver
}

func testMountOpts(t *testing.T) *apiendpoint.MountOpts {
	t.Helper()
	return &apiendpoint.MountOpts{
		Logger:    riverinternaltest.Logger(t),
		Validator: apitype.NewValidator(),
	}
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
