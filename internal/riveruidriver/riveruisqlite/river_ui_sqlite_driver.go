// Package riveruisqlite implements River UI's database operations for SQLite.
package riveruisqlite

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/sqlctemplate"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
	"riverqueue.com/riverui/internal/riveruidriver/riveruisqlite/internal/dbsqlc"
)

type Driver struct{}

// New returns a SQLite River UI driver. Unlike River's primary database
// driver, it doesn't take a pool because River UI only adds queries on top of
// the executor already owned by the caller's River client.
func New() *Driver {
	return &Driver{}
}

func (*Driver) GetExecutor(riverExecutor riverdriver.Executor) riveruidriver.Executor {
	return &Executor{
		Executor: riverExecutor,
		dbtx:     riverExecutorWrapper{executor: riverExecutor},
	}
}

type Executor struct {
	riverdriver.Executor

	dbtx riverExecutorWrapper
}

var (
	_ riveruidriver.Driver   = (*Driver)(nil)
	_ riveruidriver.Executor = (*Executor)(nil)
)

func (e *Executor) JobCountByAllStatesCapped(ctx context.Context, params *riveruidriver.JobCountByAllStatesCappedParams) (map[rivertype.JobState]int, error) {
	if params.Max < 1 {
		return nil, errors.New("count max must be positive")
	}
	if params.Max >= math.MaxInt32 {
		return nil, errors.New("count max is too large")
	}

	row, err := dbsqlc.JobCountByAllStatesCappedRiver(schemaTemplateParam(ctx, params.Schema), e.dbtx, int64(params.Max+1))
	if err != nil {
		return nil, fmt.Errorf("error counting jobs by state: %w", err)
	}

	return countsByState(row.Available, row.Cancelled, row.Completed, row.Discarded, row.Pending, row.Retryable, row.Running, row.Scheduled), nil
}

func (*Executor) JobCountEstimate(_ context.Context, params *riveruidriver.JobCountEstimateParams) (map[rivertype.JobState]riveruidriver.JobCountEstimateResult, error) {
	// Validate states even though SQLite returns no estimates so unsupported
	// input behaves consistently across River UI drivers.
	for _, state := range params.States {
		switch state {
		case rivertype.JobStateAvailable,
			rivertype.JobStateCancelled,
			rivertype.JobStateCompleted,
			rivertype.JobStateDiscarded,
			rivertype.JobStatePending,
			rivertype.JobStateRetryable,
			rivertype.JobStateRunning,
			rivertype.JobStateScheduled:
		default:
			return nil, fmt.Errorf("invalid job state for count estimate: %q", state)
		}
	}

	// SQLite has no PostgreSQL-style planner estimate. An empty result lets the
	// endpoint fall back to the lower bound established by the capped query.
	return map[rivertype.JobState]riveruidriver.JobCountEstimateResult{}, nil
}

func countsByState(available, cancelled, completed, discarded, pending, retryable, running, scheduled int64) map[rivertype.JobState]int {
	return map[rivertype.JobState]int{
		rivertype.JobStateAvailable: int(available),
		rivertype.JobStateCancelled: int(cancelled),
		rivertype.JobStateCompleted: int(completed),
		rivertype.JobStateDiscarded: int(discarded),
		rivertype.JobStatePending:   int(pending),
		rivertype.JobStateRetryable: int(retryable),
		rivertype.JobStateRunning:   int(running),
		rivertype.JobStateScheduled: int(scheduled),
	}
}

func schemaTemplateParam(ctx context.Context, schema string) context.Context {
	if schema != "" {
		schema = dbutil.SafeIdentifier(schema) + "."
	}

	return sqlctemplate.WithReplacements(ctx, map[string]sqlctemplate.Replacement{
		"schema": {Value: schema, Stable: true},
	}, nil)
}

type riverExecutorWrapper struct {
	executor riverdriver.Executor
}

func (w riverExecutorWrapper) QueryRow(ctx context.Context, query string, args ...any) dbsqlc.Row {
	// River's executor owns the dialect-specific sqlctemplate wrapper, so pass
	// the query and context through unchanged and let it consume the template.
	return w.executor.QueryRow(ctx, query, args...)
}
