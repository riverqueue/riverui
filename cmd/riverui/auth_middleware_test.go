package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apimiddleware"
)

func TestAuthMiddleware(t *testing.T) {
	t.Parallel()

	const (
		basicAuthPassword = "test_auth_pass"
		basicAuthUsername = "test_auth_user"
	)

	ctx := context.Background()

	type testBundle struct {
		handler http.Handler
	}

	setup := func(t *testing.T) (*authMiddleware, *testBundle) {
		t.Helper()

		authMiddleware := &authMiddleware{username: basicAuthUsername, password: basicAuthPassword}

		return authMiddleware, &testBundle{
			handler: apimiddleware.NewMiddlewareStack(
				authMiddleware,
			).Mount(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})),
		}
	}

	t.Run("Unauthorized", func(t *testing.T) {
		t.Parallel()

		_, bundle := setup(t)

		req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/jobs", nil)

		recorder := httptest.NewRecorder()
		bundle.handler.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusUnauthorized, recorder.Code)
	})

	t.Run("Authorized", func(t *testing.T) { //nolint:paralleltest
		t.Parallel()

		_, bundle := setup(t)

		req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/jobs", nil)
		req.SetBasicAuth(basicAuthUsername, basicAuthPassword)

		recorder := httptest.NewRecorder()
		bundle.handler.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("HealthCheckExemption", func(t *testing.T) { //nolint:paralleltest
		t.Parallel()

		_, bundle := setup(t)

		req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/health-checks/complete", nil)

		recorder := httptest.NewRecorder()
		bundle.handler.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("HealthCheckExemptionWithPrefix", func(t *testing.T) { //nolint:paralleltest
		t.Parallel()

		middleware, bundle := setup(t)
		middleware.pathPrefix = "/test-prefix"

		req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/test-prefix/api/health-checks/complete", nil)

		recorder := httptest.NewRecorder()
		bundle.handler.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusOK, recorder.Code)
	})
}
