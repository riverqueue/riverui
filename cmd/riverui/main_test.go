package main

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivershared/riversharedtest"
)

func TestInitServer(t *testing.T) {
	var (
		ctx         = context.Background()
		databaseURL = cmp.Or(os.Getenv("TEST_DATABASE_URL"), "postgres://localhost/river_test")
	)

	t.Setenv("DEV", "true")

	type testBundle struct{}

	setup := func(t *testing.T) (*initServerResult, *testBundle) {
		t.Helper()

		initRes, err := initServer(ctx, riversharedtest.Logger(t), "/")
		require.NoError(t, err)
		t.Cleanup(initRes.dbPool.Close)

		return initRes, &testBundle{}
	}

	t.Run("WithDatabaseURL", func(t *testing.T) {
		t.Setenv("DATABASE_URL", databaseURL)

		initRes, _ := setup(t)

		_, err := initRes.dbPool.Exec(ctx, "SELECT 1")
		require.NoError(t, err)
	})

	t.Run("WithPGEnvVars", func(t *testing.T) {
		// Verify that DATABASE_URL is indeed not set to be sure we're taking
		// the configuration branch we expect to be taking.
		require.Empty(t, os.Getenv("DATABASE_URL"))

		parsedURL, err := url.Parse(databaseURL)
		require.NoError(t, err)

		t.Setenv("PGDATABASE", parsedURL.Path[1:])
		t.Setenv("PGHOST", parsedURL.Hostname())
		pass, _ := parsedURL.User.Password()
		t.Setenv("PGPASSWORD", pass)
		t.Setenv("PGPORT", cmp.Or(parsedURL.Port(), "5432"))
		t.Setenv("PGSSLMODE", parsedURL.Query().Get("sslmode"))
		t.Setenv("PGUSER", parsedURL.User.Username())

		initRes, _ := setup(t)

		_, err = initRes.dbPool.Exec(ctx, "SELECT 1")
		require.NoError(t, err)
	})

	t.Run("JobListHideArgsByDefault", func(t *testing.T) {
		t.Run("default value is false", func(t *testing.T) {
			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiServer.ServeHTTP(recorder, req)
			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}
			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.False(t, resp.JobListHideArgsByDefault)
		})

		t.Run("set to true with true", func(t *testing.T) {
			t.Setenv("JOB_LIST_HIDE_ARGS_BY_DEFAULT", "true")
			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiServer.ServeHTTP(recorder, req)
			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}
			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.True(t, resp.JobListHideArgsByDefault)
		})

		t.Run("set to true with 1", func(t *testing.T) {
			t.Setenv("JOB_LIST_HIDE_ARGS_BY_DEFAULT", "1")
			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiServer.ServeHTTP(recorder, req)
			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}
			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.True(t, resp.JobListHideArgsByDefault)
		})
	})
}
