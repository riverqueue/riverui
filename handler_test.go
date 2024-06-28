package riverui

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/riverui/internal/riverinternaltest"
)

func TestNewHandlerIntegration(t *testing.T) {
	t.Parallel()

	var (
		ctx    = context.Background()
		logger = riverinternaltest.Logger(t)
		client = insertOnlyClient(t, logger)
		tx     = riverinternaltest.TestTx(ctx, t)
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

			handler, err := NewHandler(&HandlerOpts{
				Client: client,
				DBPool: tx,
				Logger: logger,
			})
			require.NoError(t, err)

			var body io.Reader
			if len(payload) > 0 {
				body = bytes.NewBuffer(payload)
			}

			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(method, path, body)

			t.Logf("--> %s %s", method, path)

			handler.ServeHTTP(recorder, req)

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

	insertRes, err := client.InsertTx(ctx, tx, &noOpArgs{}, nil)
	require.NoError(t, err)
	job := insertRes.Job

	//
	// API calls
	//

	makeAPICall(t, "JobCancel", http.MethodPost, makeURL("/api/jobs/cancel"), mustMarshalJSON(t, &jobCancelRequest{JobIDs: []int64String{int64String(job.ID)}}))
	makeAPICall(t, "JobGet", http.MethodGet, makeURL("/api/jobs/%d", job.ID), nil)
}
