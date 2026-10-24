// Package riveruidrivertest provides a shared conformance suite for River UI
// database drivers.
package riveruidrivertest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"

	"riverqueue.com/riverui/internal/riveruidriver"
)

// Exercise runs River UI's complete driver contract against a concrete driver.
// executorWithTx must return an executor in an isolated, migrated transaction
// and the schema that River UI queries should target.
func Exercise(
	ctx context.Context,
	t *testing.T,
	databaseName string,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()

	exerciseGetExecutor(ctx, t, driver, executorWithTx)
	exerciseJobCountByAllStatesCapped(ctx, t, driver, executorWithTx)
	exerciseJobCountEstimate(ctx, t, databaseName, driver, executorWithTx)
}

func exerciseGetExecutor(
	ctx context.Context,
	t *testing.T,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()

	t.Run("GetExecutor", func(t *testing.T) {
		t.Parallel()

		riverExecutor, _ := executorWithTx(ctx, t)
		executor := driver.GetExecutor(riverExecutor)

		require.NoError(t, executor.Exec(ctx, "SELECT 1"))
	})
}

func executorWithSchema(
	ctx context.Context,
	t *testing.T,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) (riveruidriver.Executor, string) {
	t.Helper()

	riverExecutor, schema := executorWithTx(ctx, t)
	return driver.GetExecutor(riverExecutor), schema
}
