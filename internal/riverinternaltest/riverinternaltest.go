package riverinternaltest

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivershared/slogtest"
)

// Logger returns a logger suitable for use in tests.
//
// Defaults to informational verbosity. If env is set with `RIVER_DEBUG=true`,
// debug level verbosity is activated.
func Logger(tb testing.TB) *slog.Logger {
	tb.Helper()

	if os.Getenv("RIVER_DEBUG") == "1" || os.Getenv("RIVER_DEBUG") == "true" {
		return slogtest.NewLogger(tb, &slog.HandlerOptions{Level: slog.LevelDebug})
	}

	return slogtest.NewLogger(tb, nil)
}

// A pool and mutex to protect it, lazily initialized by TestTx. Once open, this
// pool is never explicitly closed, instead closing implicitly as the package
// tests finish.
var (
	dbPool   *pgxpool.Pool //nolint:gochecknoglobals
	dbPoolMu sync.RWMutex  //nolint:gochecknoglobals
)

// TestTx starts a test transaction that's rolled back automatically as the test
// case is cleaning itself up. This can be used as a lighter weight alternative
// to `testdb.Manager` in components where it's not necessary to have many
// connections open simultaneously.
func TestTx(ctx context.Context, tb testing.TB) pgx.Tx {
	tb.Helper()

	tryPool := func() *pgxpool.Pool {
		dbPoolMu.RLock()
		defer dbPoolMu.RUnlock()
		return dbPool
	}

	getPool := func() *pgxpool.Pool {
		if dbPool := tryPool(); dbPool != nil {
			return dbPool
		}

		dbPoolMu.Lock()
		defer dbPoolMu.Unlock()

		// Multiple goroutines may have passed the initial `nil` check on start
		// up, so check once more to make sure pool hasn't been set yet.
		if dbPool != nil {
			return dbPool
		}

		testDatabaseURL := os.Getenv("TEST_DATABASE_URL")
		if testDatabaseURL == "" {
			testDatabaseURL = "postgres://localhost/river_test"
		}

		var err error
		dbPool, err = pgxpool.New(ctx, testDatabaseURL)
		require.NoError(tb, err)

		return dbPool
	}

	tx, err := getPool().Begin(ctx)
	require.NoError(tb, err)

	tb.Cleanup(func() {
		err := tx.Rollback(ctx)

		if err == nil {
			return
		}

		// Try to look for an error on rollback because it does occasionally
		// reveal a real problem in the way a test is written. However, allow
		// tests to roll back their transaction early if they like, so ignore
		// `ErrTxClosed`.
		if errors.Is(err, pgx.ErrTxClosed) {
			return
		}

		// In case of a cancelled context during a database operation, which
		// happens in many tests, pgx seems to not only roll back the
		// transaction, but closes the connection, and returns this error on
		// rollback. Allow this error since it's hard to prevent it in our flows
		// that use contexts heavily.
		if err.Error() == "conn closed" {
			return
		}

		// Similar to the above, but a newly appeared error that wraps the
		// above. As far as I can tell, no error variables are available to use
		// with `errors.Is`.
		if err.Error() == "failed to deallocate cached statement(s): conn closed" {
			return
		}

		require.NoError(tb, err)
	})

	return tx
}
