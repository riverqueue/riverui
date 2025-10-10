package riveruicmd

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
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

func TestInitServer(t *testing.T) { //nolint:tparallel
	// Cannot be parallelized because of Setenv calls.
	var (
		ctx         = context.Background()
		databaseURL = cmp.Or(os.Getenv("TEST_DATABASE_URL"), "postgres://localhost/river_test")
	)

	t.Setenv("DEV", "true")
	t.Setenv("DATABASE_URL", databaseURL)

	type testBundle struct{}

	setup := func(t *testing.T) (*initServerResult, *testBundle) {
		t.Helper()

		initRes, err := initServer(ctx, riversharedtest.Logger(t), "/",
			func(dbPool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
				return river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
			},
			func(client *river.Client[pgx.Tx]) uiendpoints.Bundle {
				return riverui.NewEndpoints(client, nil)
			},
		)
		require.NoError(t, err)
		t.Cleanup(initRes.dbPool.Close)

		return initRes, &testBundle{}
	}

	t.Run("WithDatabaseURL", func(t *testing.T) {
		t.Parallel()
		initRes, _ := setup(t)

		_, err := initRes.dbPool.Exec(ctx, "SELECT 1")
		require.NoError(t, err)
	})

	t.Run("WithPGEnvVars", func(t *testing.T) { //nolint:paralleltest
		// Cannot be parallelized because of Setenv calls.
		t.Setenv("DATABASE_URL", "")

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
		t.Run("DefaultValueIsFalse", func(t *testing.T) {
			t.Parallel()

			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiHandler.ServeHTTP(recorder, req)

			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}

			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.False(t, resp.JobListHideArgsByDefault)
		})

		t.Run("SetToTrueWithTrue", func(t *testing.T) { //nolint:paralleltest
			// Cannot be parallelized because of Setenv calls.
			t.Setenv("RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT", "true")
			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiHandler.ServeHTTP(recorder, req)

			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}

			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.True(t, resp.JobListHideArgsByDefault)
		})

		t.Run("SetToTrueWith1", func(t *testing.T) { //nolint:paralleltest
			// Cannot be parallelized because of Setenv calls.
			t.Setenv("RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT", "1")
			initRes, _ := setup(t)
			req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
			recorder := httptest.NewRecorder()
			initRes.uiHandler.ServeHTTP(recorder, req)

			var resp struct {
				JobListHideArgsByDefault bool `json:"job_list_hide_args_by_default"`
			}

			err := json.Unmarshal(recorder.Body.Bytes(), &resp)
			require.NoError(t, err)
			require.True(t, resp.JobListHideArgsByDefault)
		})
	})
}
