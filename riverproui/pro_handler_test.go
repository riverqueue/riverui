package riverproui

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver"
	"riverqueue.com/riverpro/driver/riverpropgxv5"

	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/handlertest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/uicommontest"
	"riverqueue.com/riverui/riverproui/internal/protestfactory"
	"riverqueue.com/riverui/uiendpoints"
)

func TestProHandlerIntegration(t *testing.T) {
	t.Parallel()

	var schema string

	createBundle := func(client *riverpro.Client[pgx.Tx], tx pgx.Tx) uiendpoints.Bundle {
		return NewEndpoints(client, &EndpointsOpts[pgx.Tx]{Tx: &tx})
	}

	createClient := func(ctx context.Context, tb testing.TB, logger *slog.Logger) (*riverpro.Client[pgx.Tx], riverdriver.Driver[pgx.Tx], pgx.Tx) {
		tb.Helper()

		workers := river.NewWorkers()
		river.AddWorker(workers, &uicommontest.NoOpWorker{})

		driver := riverpropgxv5.New(riversharedtest.DBPool(ctx, tb))
		tx, testSchema := riverdbtest.TestTxPgxDriver(ctx, tb, driver, nil)
		schema = testSchema

		client, err := riverpro.NewClient(driver, &riverpro.Config{
			Config: river.Config{
				Logger:  logger,
				Schema:  testSchema,
				Workers: workers,
			},
		})
		require.NoError(tb, err)

		return client, driver, tx
	}

	createHandler := func(t *testing.T, bundle uiendpoints.Bundle) http.Handler {
		t.Helper()

		logger := riversharedtest.Logger(t)
		opts := &riverui.HandlerOpts{
			DevMode:   true,
			Endpoints: bundle,
			LiveFS:    false, // Disable LiveFS to avoid needing projectRoot
			Logger:    logger,
		}
		handler, err := riverui.NewHandler(opts)
		require.NoError(t, err)
		return handler
	}

	testRunner := func(exec riverdriver.Executor, dbDriver riverdriver.Driver[pgx.Tx], makeAPICall handlertest.APICallFunc) {
		ctx := context.Background()

		proExec, ok := exec.(driver.ProExecutor)
		require.True(t, ok)
		proDriver, ok := dbDriver.(driver.ProDriver[pgx.Tx])
		require.True(t, ok)

		_ = protestfactory.PeriodicJob(ctx, t, proExec, nil)

		queue := testfactory.Queue(ctx, t, exec, nil)

		workflowID := uuid.New()
		require.NoError(t, proDriver.GetProExecutor().WorkflowInsertMany(ctx, &driver.WorkflowInsertManyParams{
			IDs:    []string{workflowID.String()},
			Names:  []string{workflowID.String()},
			Schema: schema,
		}))
		_ = testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: uicommontest.MustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})
		workflowID2 := uuid.New()
		require.NoError(t, proDriver.GetProExecutor().WorkflowInsertMany(ctx, &driver.WorkflowInsertManyParams{
			IDs:    []string{workflowID2.String()},
			Names:  []string{workflowID2.String()},
			Schema: schema,
		}))
		_ = testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: uicommontest.MustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID2})})

		// Verify OSS features endpoint is mounted and returns success even w/ Pro bundle:
		makeAPICall(t, "FeaturesGet", http.MethodGet, "/api/features", nil)

		makeAPICall(t, "PeriodicJobList", http.MethodGet, "/api/pro/periodic-jobs", nil)
		makeAPICall(t, "ProducerList", http.MethodGet, "/api/pro/producers?queue_name="+queue.Name, nil)
		makeAPICall(t, "WorkflowCancel", http.MethodPost, fmt.Sprintf("/api/pro/workflows/%s/cancel", workflowID), nil)
		makeAPICall(t, "WorkflowGet", http.MethodGet, fmt.Sprintf("/api/pro/workflows/%s", workflowID2), nil)
		makeAPICall(t, "WorkflowList", http.MethodGet, "/api/pro/workflows", nil)
	}

	handlertest.RunIntegrationTest(t, createClient, createBundle, createHandler, testRunner)
}

func TestProMountedEndpointResponses(t *testing.T) {
	t.Parallel()

	type testBundle struct {
		client  *riverpro.Client[pgx.Tx]
		handler http.Handler
		logger  *slog.Logger
		schema  string
		tx      pgx.Tx
	}

	setup := func(ctx context.Context, t *testing.T) *testBundle {
		t.Helper()

		logger := riversharedtest.Logger(t)
		driver := riverpropgxv5.New(riversharedtest.DBPool(ctx, t))
		tx, schema := riverdbtest.TestTxPgxDriver(ctx, t, driver, &riverdbtest.TestTxOpts{DisableSchemaSharing: true})
		client, err := riverpro.NewClient(driver, &riverpro.Config{
			Config: river.Config{
				Logger: logger,
				Schema: schema,
			},
		})
		require.NoError(t, err)

		bundle := NewEndpoints(client, &EndpointsOpts[pgx.Tx]{Tx: &tx})

		handler, err := riverui.NewHandler(&riverui.HandlerOpts{
			DevMode:   true,
			Endpoints: bundle,
			LiveFS:    false,
			Logger:    logger,
		})
		require.NoError(t, err)

		return &testBundle{
			client:  client,
			handler: handler,
			logger:  logger,
			schema:  schema,
			tx:      tx,
		}
	}

	ctx := context.Background()
	bundle := setup(ctx, t)

	recorder := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/features", nil)

	bundle.handler.ServeHTTP(recorder, req)

	status := recorder.Result().StatusCode
	require.Equal(t, http.StatusOK, status)

	contentType := recorder.Header().Get("Content-Type")
	// apiframe sets JSON content-type with charset; allow either exact or prefixed
	require.Contains(t, contentType, "application/json")

	var resp struct {
		Extensions               map[string]bool `json:"extensions"`
		JobListHideArgsByDefault bool            `json:"job_list_hide_args_by_default"`
	}

	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
	require.NotNil(t, resp.Extensions)

	// Static flags always true; dynamic flags should also be true because pro migrations run for tests
	expectedExtensions := map[string]bool{
		"durable_periodic_jobs": true, // dynamic
		"has_client_table":      true, // dynamic
		"has_producer_table":    true, // dynamic
		"has_sequence_table":    true, // dynamic
		"producer_queries":      true, // static
		"workflow_queries":      true, // dynamic
	}
	require.Equal(t, expectedExtensions, resp.Extensions)

	recorder = httptest.NewRecorder()
	req = httptest.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"/api/pro/workflows/missing-workflow/task-wait-diagnostics?task_name=await_review",
		nil,
	)
	req.Header.Set("Accept", "*/*")

	bundle.handler.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusNotFound, recorder.Result().StatusCode)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.Contains(t, recorder.Body.String(), "Workflow not found")
}
