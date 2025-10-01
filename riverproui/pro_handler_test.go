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

	createBundle := func(client *riverpro.Client[pgx.Tx], tx pgx.Tx) uiendpoints.Bundle {
		return NewEndpoints(client, &EndpointsOpts[pgx.Tx]{Tx: &tx})
	}

	createClient := func(ctx context.Context, tb testing.TB, logger *slog.Logger) (*riverpro.Client[pgx.Tx], riverdriver.Driver[pgx.Tx], pgx.Tx) {
		tb.Helper()

		workers := river.NewWorkers()
		river.AddWorker(workers, &uicommontest.NoOpWorker{})

		driver := riverpropgxv5.New(riversharedtest.DBPool(ctx, tb))
		tx, _ := riverdbtest.TestTxPgxDriver(ctx, tb, driver, nil)

		client, err := riverpro.NewClient(driver, &riverpro.Config{
			Config: river.Config{
				Logger:  logger,
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

	testRunner := func(exec riverdriver.Executor, makeAPICall handlertest.APICallFunc) {
		ctx := context.Background()

		proExec, ok := exec.(driver.ProExecutor)
		require.True(t, ok)

		_ = protestfactory.PeriodicJob(ctx, t, proExec, nil)

		queue := testfactory.Queue(ctx, t, exec, nil)

		workflowID := uuid.New()
		_ = testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: uicommontest.MustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})
		workflowID2 := uuid.New()
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

func TestProFeaturesEndpointResponse(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	logger := riversharedtest.Logger(t)

	driver := riverpropgxv5.New(riversharedtest.DBPool(ctx, t))
	tx, _ := riverdbtest.TestTxPgxDriver(ctx, t, driver, &riverdbtest.TestTxOpts{DisableSchemaSharing: true})
	client, err := riverpro.NewClient(driver, &riverpro.Config{
		Config: river.Config{
			Logger: logger,
		},
	})
	require.NoError(t, err)

	bundle := NewEndpoints(client, &EndpointsOpts[pgx.Tx]{Tx: &tx})

	// Reuse the same handler creation pattern as integration tests
	handler := func() http.Handler {
		logger := riversharedtest.Logger(t)
		opts := &riverui.HandlerOpts{
			DevMode:   true,
			Endpoints: bundle,
			LiveFS:    false,
			Logger:    logger,
		}
		h, err := riverui.NewHandler(opts)
		require.NoError(t, err)
		return h
	}()

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/features", nil)

	handler.ServeHTTP(recorder, req)

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
		"has_workflows":         true, // dynamic
		"producer_queries":      true, // static
		"workflow_queries":      true, // static
	}
	require.Equal(t, expectedExtensions, resp.Extensions)
}
