package handlertest

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverui/uiendpoints"
)

type APICallFunc = func(t *testing.T, testCaseName, method, path string, payload []byte)

func RunIntegrationTest[TClient any](t *testing.T, createClient func(ctx context.Context, tb testing.TB, logger *slog.Logger) (TClient, riverdriver.Driver[pgx.Tx], pgx.Tx), createBundle func(client TClient, tx pgx.Tx) uiendpoints.Bundle, createHandler func(t *testing.T, bundle uiendpoints.Bundle) http.Handler, testRunner func(exec riverdriver.Executor, makeAPICall APICallFunc)) {
	t.Helper()

	var (
		ctx                = t.Context()
		logger             = riversharedtest.Logger(t)
		client, driver, tx = createClient(ctx, t, logger)
		exec               = driver.UnwrapExecutor(tx)
	)

	makeAPICall := func(t *testing.T, testCaseName, method, path string, payload []byte) {
		t.Helper()

		t.Run(testCaseName, func(t *testing.T) {
			// Start a new savepoint so that the state of our test data stays
			// pristine between API calls.
			tx, err := tx.Begin(ctx)
			require.NoError(t, err)
			t.Cleanup(func() { tx.Rollback(ctx) })

			bundle := createBundle(client, tx)
			handler := createHandler(t, bundle)

			var body io.Reader
			if len(payload) > 0 {
				body = bytes.NewBuffer(payload)
			}

			req := httptest.NewRequest(method, path, body)
			recorder := httptest.NewRecorder()

			t.Logf("--> %s %s", method, path)

			handler.ServeHTTP(recorder, req)

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

	testRunner(exec, makeAPICall)
}
