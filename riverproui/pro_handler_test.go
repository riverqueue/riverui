package riverproui

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver/riverpropgxv5"
	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/handlertest"
	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

type noOpArgs struct {
	Name string `json:"name"`
}

func (noOpArgs) Kind() string { return "noOp" }

type noOpWorker struct {
	river.WorkerDefaults[noOpArgs]
}

func (w *noOpWorker) Work(_ context.Context, _ *river.Job[noOpArgs]) error { return nil }

func insertOnlyProClient(t *testing.T, logger *slog.Logger) (*riverpro.Client[pgx.Tx], riverdriver.Driver[pgx.Tx]) {
	t.Helper()

	workers := river.NewWorkers()
	river.AddWorker(workers, &noOpWorker{})

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

func mustMarshalJSON(t *testing.T, v any) []byte {
	t.Helper()

	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

func TestProHandlerIntegration(t *testing.T) {
	t.Parallel()

	createClient := func(t *testing.T, logger *slog.Logger) (*riverpro.Client[pgx.Tx], riverdriver.Driver[pgx.Tx]) {
		return insertOnlyProClient(t, logger)
	}

	createBundle := func(client *riverpro.Client[pgx.Tx], tx pgx.Tx) apibundle.EndpointBundle {
		return NewEndpoints(&EndpointsOpts[pgx.Tx]{
			Client: client,
			Tx:     &tx,
		})
	}

	createHandler := func(t *testing.T, bundle apibundle.EndpointBundle) http.Handler {
		logger := riverinternaltest.Logger(t)
		opts := &riverui.ServerOpts{
			DevMode: true,
			LiveFS:  false, // Disable LiveFS to avoid needing projectRoot
			Logger:  logger,
		}
		server, err := riverui.NewServer(bundle, opts)
		require.NoError(t, err)
		return server
	}

	testRunner := func(exec riverdriver.Executor, makeAPICall handlertest.APICallFunc) {
		ctx := context.Background()

		queue := testfactory.Queue(ctx, t, exec, nil)

		workflowID := uuid.New()
		_ = testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})

		makeAPICall(t, "ProducerList", http.MethodGet, fmt.Sprintf("/api/pro/producers?queue_name=%s", queue.Name), nil)
		makeAPICall(t, "WorkflowGet", http.MethodGet, fmt.Sprintf("/api/pro/workflows/%s", workflowID), nil)
		makeAPICall(t, "WorkflowList", http.MethodGet, "/api/pro/workflows", nil)
	}

	handlertest.RunIntegrationTest(t, createClient, createBundle, createHandler, testRunner)
}
