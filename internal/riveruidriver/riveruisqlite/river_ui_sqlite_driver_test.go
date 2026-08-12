package riveruisqlite_test

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riversqlite"
	"github.com/riverqueue/river/rivershared/riversharedtest"

	"riverqueue.com/riverui/internal/riveruidriver/riveruidrivertest"
	"riverqueue.com/riverui/internal/riveruidriver/riveruisqlite"
)

func TestDriver(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	riveruidrivertest.Exercise(
		ctx,
		t,
		riverdriver.DatabaseNameSQLite,
		riveruisqlite.New(),
		func(ctx context.Context, t *testing.T) (riverdriver.Executor, string) {
			t.Helper()

			riverDriver := riversqlite.New(nil)
			tx, schema := riverdbtest.TestTx[*sql.Tx](ctx, t, riverDriver, &riverdbtest.TestTxOpts{
				DisableSchemaSharing: true,
				ProcurePool: func(ctx context.Context, schema string) (any, string) {
					return riversharedtest.DBPoolSQLite(ctx, t, schema), ""
				},
			})
			return riverDriver.UnwrapExecutor(tx), schema
		},
	)
}
