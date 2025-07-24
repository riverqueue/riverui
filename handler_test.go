package riverui

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/baseservice"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
)

func TestNewHandlerIntegration(t *testing.T) {
	t.Parallel()

	var (
		ctx            = context.Background()
		logger         = riverinternaltest.Logger(t)
		client, driver = insertOnlyClient(t, logger)
		tx             = riverinternaltest.TestTx(ctx, t)
		exec           = driver.UnwrapExecutor(tx)
	)

	//
	// Helper functions
	//

	makeAPICall := func(t *testing.T, testCaseName, method, path string, payload []byte) {
		t.Helper()

		t.Run(testCaseName, func(t *testing.T) {
			logger := riverinternaltest.Logger(t)

			// Start a new savepoint so that the state of our test data stays
			// pristine between API calls.
			tx, err := tx.Begin(ctx)
			require.NoError(t, err)
			t.Cleanup(func() { tx.Rollback(ctx) })

			server, err := NewServer(&ServerOpts{
				Client:  client,
				DB:      tx,
				DevMode: true,
				LiveFS:  true,
				Logger:  logger,
			})
			require.NoError(t, err)

			var body io.Reader
			if len(payload) > 0 {
				body = bytes.NewBuffer(payload)
			}

			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(method, path, body)

			t.Logf("--> %s %s", method, path)

			server.ServeHTTP(recorder, req)

			status := recorder.Result().StatusCode
			t.Logf("Response status: %d", status)

			if status >= 200 && status < 300 {
				return
			}

			// Only print the body in the event of a problem because it may be
			// quite sizable.
			t.Logf("Response body: %s", recorder.Body.String())

			require.FailNow(t, "Got non-OK status code making request", "Expected status >= 200 && < 300; got: %d", status)
		})
	}

	makeURL := fmt.Sprintf

	//
	// Test data
	//

	job := testfactory.Job(ctx, t, exec, &testfactory.JobOpts{})

	queue := testfactory.Queue(ctx, t, exec, nil)

	// Get rid of this once https://github.com/riverqueue/river/pull/408 is available.
	queuePaused := testfactory.Queue(ctx, t, exec, &testfactory.QueueOpts{PausedAt: ptrutil.Ptr(time.Now())})

	workflowID := uuid.New()
	_ = testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: mustMarshalJSON(t, map[string]uuid.UUID{"workflow_id": workflowID})})

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
	makeAPICall(t, "ProducerList", http.MethodGet, makeURL("/api/producers?queue_name=%s", queue.Name), nil)
	makeAPICall(t, "QueueGet", http.MethodGet, makeURL("/api/queues/%s", queue.Name), nil)
	makeAPICall(t, "QueueList", http.MethodGet, makeURL("/api/queues"), nil)
	makeAPICall(t, "QueuePause", http.MethodPut, makeURL("/api/queues/%s/pause", queue.Name), nil)
	makeAPICall(t, "QueueResume", http.MethodPut, makeURL("/api/queues/%s/resume", queuePaused.Name), nil)
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
	makeAPICall(t, "WorkflowGet", http.MethodGet, makeURL("/api/workflows/%s", workflowID), nil)
	makeAPICall(t, "WorkflowList", http.MethodGet, makeURL("/api/workflows"), nil)

	//
	// Static files
	//

	makeAPICall(t, "RobotsTxt", http.MethodGet, makeURL("/robots.txt"), nil)
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

// Mock driver that implements driverHook for testing.
type mockDriverWithHook struct {
	riverdriver.Driver[pgx.Tx]
	hookCalled bool
	endpoints  []apiendpoint.EndpointInterface
}

func (m *mockDriverWithHook) RegisterUIEndpoints(mux *http.ServeMux, archetype *baseservice.Archetype, logger *slog.Logger, mountOpts *apiendpoint.MountOpts) []apiendpoint.EndpointInterface {
	m.hookCalled = true
	return m.endpoints
}

func TestDriverHookIntegration(t *testing.T) {
	t.Parallel()

	logger := riverinternaltest.Logger(t)

	t.Run("DriverImplementsHook", func(t *testing.T) {
		t.Parallel()

		// Create a mock driver that implements driverHook
		mockDriver := &mockDriverWithHook{
			Driver:     riverpgxv5.New(nil),
			hookCalled: false,
			endpoints:  []apiendpoint.EndpointInterface{},
		}

		// Test the type assertion logic that would be used in NewServer
		// We can't easily test NewServer directly with our mock since it expects
		// a real client, but we can test the core logic
		var driver interface{} = mockDriver
		if hook, ok := driver.(driverHook); ok {
			hook.RegisterUIEndpoints(nil, nil, logger, nil)
			require.True(t, mockDriver.hookCalled, "driverHook.RegisterUIEndpoints should have been called")
		}
	})

	t.Run("DriverDoesNotImplementHook", func(t *testing.T) {
		t.Parallel()

		// Use a regular client without the hook
		client, _ := insertOnlyClient(t, logger)

		// Test that regular drivers don't implement driverHook
		driver := client.Driver()
		_, implementsHook := driver.(driverHook)
		require.False(t, implementsHook, "Regular drivers should not implement driverHook")
	})
}
