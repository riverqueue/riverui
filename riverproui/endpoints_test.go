package riverproui

import (
	"context"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver/riverpropgxv5"

	"riverqueue.com/riverui/internal/uicommontest"
)

func TestProEndpointsExtensions(t *testing.T) {
	t.Parallel()

	// Most of these tests involve schema changes and can't be parallelized without
	// causing deadlocks.
	ctx := context.Background()

	type testBundle struct {
		client   *riverpro.Client[pgx.Tx]
		endpoint *endpoints[pgx.Tx]
		logger   *slog.Logger
		tx       pgx.Tx
	}

	setup := func(ctx context.Context, t *testing.T) *testBundle {
		t.Helper()

		logger := riversharedtest.Logger(t)

		workers := river.NewWorkers()
		river.AddWorker(workers, &uicommontest.NoOpWorker{})

		// We're making DB schema changes, so we need to disable schema sharing:
		driver := riverpropgxv5.New(riversharedtest.DBPool(ctx, t))
		tx, _ := riverdbtest.TestTxPgxDriver(ctx, t, driver, &riverdbtest.TestTxOpts{DisableSchemaSharing: true})
		client, err := riverpro.NewClient(driver, &riverpro.Config{
			Config: river.Config{
				Logger:  logger,
				Workers: workers,
			},
		})
		require.NoError(t, err)

		endpoint := &endpoints[pgx.Tx]{
			client:  client,
			proOpts: &EndpointsOpts[pgx.Tx]{Tx: &tx},
		}

		return &testBundle{
			client:   client,
			endpoint: endpoint,
			logger:   logger,
			tx:       tx,
		}
	}

	t.Run("DurablePeriodicJobs", func(t *testing.T) { //nolint:dupl
		t.Parallel()

		t.Run("NoPeriodicJobTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_periodic_job;`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.False(t, ext["durable_periodic_jobs"])
		})

		t.Run("WithPeriodicJobTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_periodic_job (id SERIAL PRIMARY KEY);`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.True(t, ext["durable_periodic_jobs"])
		})
	})

	t.Run("ClientTableDetection", func(t *testing.T) { //nolint:dupl
		t.Parallel()

		t.Run("NoClientTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_client CASCADE;`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.False(t, ext["has_client_table"])
		})

		t.Run("WithClientTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_client (id SERIAL PRIMARY KEY);`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.True(t, ext["has_client_table"])
		})
	})

	t.Run("ProducerTableDetection", func(t *testing.T) { //nolint:dupl
		t.Parallel()

		t.Run("NoProducerTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_producer;`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.False(t, ext["has_producer_table"])
		})

		t.Run("WithProducerTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_producer (id SERIAL PRIMARY KEY);`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.True(t, ext["has_producer_table"])
		})
	})

	t.Run("SequenceTableDetection", func(t *testing.T) { //nolint:dupl
		t.Parallel()

		t.Run("NoSequenceTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_job_sequence;`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.False(t, ext["has_sequence_table"])
		})

		t.Run("WithSequenceTable", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_job_sequence (id SERIAL PRIMARY KEY);`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.True(t, ext["has_sequence_table"])
		})
	})

	t.Run("WorkflowsDetection", func(t *testing.T) {
		t.Parallel()

		t.Run("NoWorkflowIndexes", func(t *testing.T) {
			t.Parallel()

			bundle := setup(ctx, t)

			_, err := bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_list_active;`)
			require.NoError(t, err)
			_, err = bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_scheduling;`)
			require.NoError(t, err)

			ext, err := bundle.endpoint.Extensions(ctx)
			require.NoError(t, err)
			require.False(t, ext["has_workflows"])
		})
	})

	t.Run("StaticAttributesAlwaysTrue", func(t *testing.T) {
		t.Parallel()

		bundle := setup(ctx, t)

		ext, err := bundle.endpoint.Extensions(ctx)
		require.NoError(t, err)
		require.True(t, ext["producer_queries"])
		require.True(t, ext["workflow_queries"])
	})
}
