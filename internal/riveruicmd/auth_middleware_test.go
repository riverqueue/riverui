package riveruicmd

import (
	"cmp"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverui"
	"riverqueue.com/riverui/uiendpoints"
)

func TestAuthMiddleware(t *testing.T) { //nolint:tparallel
	// Cannot be parallelized because of Setenv calls.
	var (
		ctx               = context.Background()
		databaseURL       = cmp.Or(os.Getenv("TEST_DATABASE_URL"), "postgres://localhost/river_test")
		basicAuthUser     = "test_auth_user"
		basicAuthPassword = "test_auth_pass"
	)

	t.Setenv("DEV", "true")
	t.Setenv("DATABASE_URL", databaseURL)
	t.Setenv("RIVER_BASIC_AUTH_USER", basicAuthUser)
	t.Setenv("RIVER_BASIC_AUTH_PASS", basicAuthPassword)

	setup := func(t *testing.T, prefix string) http.Handler {
		t.Helper()
		initRes, err := initServer(ctx,
			&initServerOpts{
				logger:     riversharedtest.Logger(t),
				pathPrefix: prefix,
			},
			func(dbPool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
				return river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
			},
			func(client *river.Client[pgx.Tx]) uiendpoints.Bundle {
				return riverui.NewEndpoints(client, nil)
			},
		)
		require.NoError(t, err)
		t.Cleanup(initRes.dbPool.Close)

		return initRes.httpServer.Handler
	}

	t.Run("Unauthorized", func(t *testing.T) {
		t.Parallel()

		handler := setup(t, "/")
		req := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	})

	t.Run("Authorized", func(t *testing.T) {
		t.Parallel()

		handler := setup(t, "/")
		req := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
		req.SetBasicAuth(basicAuthUser, basicAuthPassword)

		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("Healthcheck exemption", func(t *testing.T) {
		t.Parallel()

		handler := setup(t, "/")
		req := httptest.NewRequest(http.MethodGet, "/api/health-checks/complete", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("Healthcheck exemption with prefix", func(t *testing.T) {
		t.Parallel()

		handler := setup(t, "/test-prefix")
		req := httptest.NewRequest(http.MethodGet, "/test-prefix/api/health-checks/complete", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
	})
}
