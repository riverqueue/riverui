package riverui

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverui/internal/handlertest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/uicommontest"
	"riverqueue.com/riverui/uiendpoints"
)

func TestNewHandlerIntegration(t *testing.T) {
	t.Parallel()

	createClient := func(ctx context.Context, tb testing.TB, logger *slog.Logger) (*river.Client[pgx.Tx], riverdriver.Driver[pgx.Tx], pgx.Tx) {
		tb.Helper()

		driver := riverpgxv5.New(riversharedtest.DBPool(ctx, tb))
		tx, _ := riverdbtest.TestTxPgxDriver(ctx, tb, driver, nil)

		client, err := river.NewClient(driver, &river.Config{
			Logger: logger,
		})
		require.NoError(tb, err)

		return client, driver, tx
	}

	createBundle := func(client *river.Client[pgx.Tx], tx pgx.Tx) uiendpoints.Bundle {
		return NewEndpoints(client, &EndpointsOpts[pgx.Tx]{
			Tx: &tx,
		})
	}

	createHandler := func(t *testing.T, bundle uiendpoints.Bundle) http.Handler {
		t.Helper()

		logger := riversharedtest.Logger(t)
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
		makeAPICall(t, "JobCancel", http.MethodPost, makeURL("/api/jobs/cancel"), uicommontest.MustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "JobDelete", http.MethodPost, makeURL("/api/jobs/delete"), uicommontest.MustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "JobGet", http.MethodGet, makeURL("/api/jobs/%d", job.ID), nil)
		makeAPICall(t, "JobList", http.MethodGet, makeURL("/api/jobs"), nil)
		makeAPICall(t, "JobRetry", http.MethodPost, makeURL("/api/jobs/retry"), uicommontest.MustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
		makeAPICall(t, "QueueGet", http.MethodGet, makeURL("/api/queues/%s", queue.Name), nil)
		makeAPICall(t, "QueueList", http.MethodGet, makeURL("/api/queues"), nil)
		makeAPICall(t, "QueuePause", http.MethodPut, makeURL("/api/queues/%s/pause", queue.Name), nil)
		makeAPICall(t, "QueueResume", http.MethodPut, makeURL("/api/queues/%s/resume", queue.Name), nil)
		makeAPICall(t, "QueueUpdate", http.MethodPatch, makeURL("/api/queues/%s", queue.Name), uicommontest.MustMarshalJSON(t, &queueUpdateRequest{
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
		logger = riversharedtest.Logger(t)
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

func TestNormalizePathPrefix(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "Empty", input: "", want: ""},
		{name: "Root", input: "/", want: ""},
		{name: "NoLeadingSlash", input: "prefix", want: "/prefix"},
		{name: "LeadingSlash", input: "/prefix", want: "/prefix"},
		{name: "TrailingSlash", input: "/prefix/", want: "/prefix"},
		{name: "NoLeadingWithTrailing", input: "prefix/", want: "/prefix"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tt.want, NormalizePathPrefix(tt.input))
		})
	}
}
