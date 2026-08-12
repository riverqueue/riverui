package riveruipostgres_test

import (
	"context"
	"testing"

	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverui/internal/riveruidriver/riveruidrivertest"
	"riverqueue.com/riverui/internal/riveruidriver/riveruipostgres"
)

func TestDriver(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	riverDriver := riverpgxv5.New(riversharedtest.DBPool(ctx, t))

	riveruidrivertest.Exercise(
		ctx,
		t,
		riverdriver.DatabaseNamePostgres,
		riveruipostgres.New(),
		func(ctx context.Context, t *testing.T) (riverdriver.Executor, string) {
			t.Helper()

			tx, schema := riverdbtest.TestTxPgxDriver(ctx, t, riverDriver, nil)
			return riverDriver.UnwrapExecutor(tx), schema
		},
	)
}
