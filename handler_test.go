package riverui

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/handlertest"
	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"

	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
)

func TestNewHandlerIntegration(t *testing.T) {
	t.Parallel()

	createClient := insertOnlyClient

	createBundle := func(client *river.Client[pgx.Tx], tx pgx.Tx) apibundle.EndpointBundle {
		return NewEndpoints(client, &EndpointsOpts[pgx.Tx]{
			Tx: &tx,
		})
	}

	createHandler := func(t *testing.T, bundle apibundle.EndpointBundle) http.Handler {
		t.Helper()

		logger := riverinternaltest.Logger(t)
		server, err := NewHandler(&HandlerOpts{
			DevMode:     true,
			Endpoints:   bundle,
			LiveFS:      true,
			Logger:      logger,
			projectRoot: "./",
		})
		require.NoError(t, err)
		return server
	}

	testRunner := func(exec riverdriver.Executor, makeAPICall handlertest.APICallFunc) {
		ctx := context.Background()

		makeURL := fmt.Sprintf

		//
		// Test data
		//

		job := testfactory.Job(ctx, t, exec, &testfactory.JobOpts{})

		queue := testfactory.Queue(ctx, t, exec, nil)

		//
		// API calls
		//

		makeAPICall(t, "Autocomplete", http.MethodGet, makeURL("/api/autocomplete?facet=job_kind"), nil)
		makeAPICall(t, "FeaturesGet", http.MethodGet, makeURL("/api/features"), nil)
		makeAPICall(t, "HealthCheckGetComplete", http.MethodGet, makeURL("/api/health-checks/%s", healthCheckNameComplete), nil)
		makeAPICall(t, "HealthCheckGetMinimal", http.MethodGet, makeURL("/api/health-checks/%s", healthCheckNameMinimal), nil)
		makeAPICall(t, "JobCancel", http.MethodPost, makeURL("/api/jobs/cancel"), mustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "JobDelete", http.MethodPost, makeURL("/api/jobs/delete"), mustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "JobGet", http.MethodGet, makeURL("/api/jobs/%d", job.ID), nil)
		makeAPICall(t, "JobList", http.MethodGet, makeURL("/api/jobs"), nil)
		makeAPICall(t, "JobRetry", http.MethodPost, makeURL("/api/jobs/retry"), mustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "QueueGet", http.MethodGet, makeURL("/api/queues/%s", queue.Name), nil)
		makeAPICall(t, "QueueList", http.MethodGet, makeURL("/api/queues"), nil)
		makeAPICall(t, "QueuePause", http.MethodPut, makeURL("/api/queues/%s/pause", queue.Name), nil)
		makeAPICall(t, "QueueResume", http.MethodPut, makeURL("/api/queues/%s/resume", queue.Name), nil)
		makeAPICall(t, "QueueUpdate", http.MethodPatch, makeURL("/api/queues/%s", queue.Name), mustMarshalJSON(t, &queueUpdateRequest{
			Concurrency: apitype.ExplicitNullable[ConcurrencyConfig]{
				Value: &ConcurrencyConfig{
					GlobalLimit: 10,
					LocalLimit:  5,
					Partition: PartitionConfig{
						ByArgs: []string{"customer_id"},
						ByKind: true,
					},
				},
			},
		}))
		makeAPICall(t, "StateAndCountGet", http.MethodGet, makeURL("/api/states"), nil)

		//
		// Static files
		//

		makeAPICall(t, "RobotsTxt", http.MethodGet, makeURL("/robots.txt"), nil)
	}

	handlertest.RunIntegrationTest(t, createClient, createBundle, createHandler, testRunner)
}

func TestMountStaticFiles(t *testing.T) {
	t.Parallel()

	var (
		logger = riverinternaltest.Logger(t)
		mux    = http.NewServeMux()
	)

	require.NoError(t, mountStaticFiles(logger, mux))

	var (
		recorder = httptest.NewRecorder()
		req      = httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	)

	mux.ServeHTTP(recorder, req)

	status := recorder.Result().StatusCode
	require.Equal(t, http.StatusOK, status)

	require.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get("Content-Type"))
	require.Contains(t, recorder.Body.String(), "User-Agent")
}
