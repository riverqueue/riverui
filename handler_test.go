package riverui

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivershared/util/ptrutil"

	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
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
			// prestine between API calls.
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

			status := recorder.Result().StatusCode //nolint:bodyclose
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
	makeAPICall(t, "QueueResume", http.MethodPut, makeURL("/api/queues/%s/resume", queuePaused.Name), nil)
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

	status := recorder.Result().StatusCode //nolint:bodyclose
	require.Equal(t, http.StatusOK, status)

	require.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get("Content-Type"))
	require.Contains(t, recorder.Body.String(), "User-Agent")
}
