// Package riveruipostgres implements River UI's database operations for
// PostgreSQL. It decorates an executor from any PostgreSQL River driver rather
// than owning a second pool.
package riveruipostgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/sqlctemplate"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
	"riverqueue.com/riverui/internal/riveruidriver/riveruipostgres/internal/dbsqlc"
)

type Driver struct{}

// New returns a PostgreSQL River UI driver. Unlike River's primary database
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

	// sqlc owns the query while the template context safely injects the optional
	// schema identifier. Max+1 lets the caller distinguish an exact count at the
	// cap from a state whose index range contains additional rows.
	row, err := dbsqlc.JobCountByAllStatesCappedRiver(schemaTemplateParam(ctx, params.Schema), e.dbtx, int32(params.Max+1))
	if err != nil {
		return nil, fmt.Errorf("error counting jobs by state: %w", err)
	}

	return countsByState(row.Available, row.Cancelled, row.Completed, row.Discarded, row.Pending, row.Retryable, row.Running, row.Scheduled), nil
}

func (e *Executor) JobCountEstimate(ctx context.Context, params *riveruidriver.JobCountEstimateParams) (map[rivertype.JobState]riveruidriver.JobCountEstimateResult, error) {
	// EXPLAIN's Plan Rows comes from PostgreSQL's existing ANALYZE statistics,
	// so it retains order-of-magnitude telemetry without reading every matching
	// row. Failure to read the timestamp doesn't invalidate the estimate itself.
	analyzedAt, analyzedAtValid, _ := dbsqlc.JobCountAnalyzedAtRiver(ctx, e.dbtx, params.Schema)
	var observedAt *time.Time
	if analyzedAtValid {
		observedAt = &analyzedAt
	}

	type explainPlan struct {
		Plan struct {
			Rows int `json:"Plan Rows"` //nolint:tagliatelle // PostgreSQL owns this JSON key.
		} `json:"Plan"` //nolint:tagliatelle // PostgreSQL owns this JSON key.
	}

	estimates := make(map[rivertype.JobState]riveruidriver.JobCountEstimateResult, len(params.States))
	explainCtx := schemaTemplateParam(ctx, params.Schema)
	for _, state := range params.States {
		rawPlan, err := dbsqlc.JobCountEstimateRiver(explainCtx, e.dbtx, state)
		if err != nil {
			return nil, fmt.Errorf("error explaining job count for state %q: %w", state, err)
		}

		var plans []explainPlan
		if err := json.Unmarshal(rawPlan, &plans); err != nil {
			return nil, fmt.Errorf("error decoding job count estimate for state %q: %w", state, err)
		}
		if len(plans) != 1 {
			return nil, fmt.Errorf("expected one job count estimate plan for state %q, got %d", state, len(plans))
		}

		estimates[state] = riveruidriver.JobCountEstimateResult{
			Count:      plans[0].Plan.Rows,
			ObservedAt: observedAt,
		}
	}

	return estimates, nil
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
