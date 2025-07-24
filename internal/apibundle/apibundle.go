package apibundle

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/baseservice"
)

// DB is the interface for a pgx database connection.
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Exec(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, query string, args ...interface{}) pgx.Row
}

// APIBundle is a bundle of common types needed for many API endpoints.
type APIBundle struct {
	Archetype                *baseservice.Archetype
	Client                   *river.Client[pgx.Tx]
	DBPool                   DB
	Driver                   riverdriver.Driver[pgx.Tx]
	Exec                     riverdriver.Executor
	JobListHideArgsByDefault bool
	Logger                   *slog.Logger
}

// SetBundle sets all values to the same as the given bundle.
func (a *APIBundle) SetBundle(bundle *APIBundle) {
	*a = *bundle
}
