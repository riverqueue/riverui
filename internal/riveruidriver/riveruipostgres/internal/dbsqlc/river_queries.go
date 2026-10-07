package dbsqlc

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/riverqueue/river/rivertype"
)

// Row and RowQuerier are the small common subset exposed by every River
// executor. sqlc's generated DBTX includes pgx-specific methods that these
// read-only UI queries don't need, so this adapter keeps the UI driver usable
// with any PostgreSQL River driver, including database/sql implementations.
type Row interface {
	Scan(dest ...any) error
}

type RowQuerier interface {
	QueryRow(ctx context.Context, query string, args ...any) Row
}

func JobCountByAllStatesCappedRiver(ctx context.Context, db RowQuerier, maxRows int32) (*JobCountByAllStatesCappedRow, error) {
	row := db.QueryRow(ctx, jobCountByAllStatesCapped, maxRows)
	var result JobCountByAllStatesCappedRow
	err := row.Scan(
		&result.Available,
		&result.Cancelled,
		&result.Completed,
		&result.Discarded,
		&result.Pending,
		&result.Retryable,
		&result.Running,
		&result.Scheduled,
	)
	return &result, err
}

func JobCountAnalyzedAtRiver(ctx context.Context, db RowQuerier, schema string) (time.Time, bool, error) {
	var analyzedAt pgtype.Timestamptz
	if err := db.QueryRow(ctx, jobCountAnalyzedAt, schema).Scan(&analyzedAt); err != nil {
		return time.Time{}, false, err
	}
	if !analyzedAt.Valid {
		return time.Time{}, false, nil
	}
	return analyzedAt.Time, true, nil
}

func JobCountEstimateRiver(ctx context.Context, db RowQuerier, state rivertype.JobState) ([]byte, error) {
	// sqlc validates and generates the EXPLAIN query constants, but can't infer
	// EXPLAIN's JSON result column, so scan that one value through this adapter.
	query, err := jobCountEstimateQuery(state)
	if err != nil {
		return nil, err
	}

	var rawPlan []byte
	if err := db.QueryRow(ctx, query).Scan(&rawPlan); err != nil {
		return nil, err
	}
	return rawPlan, nil
}

func jobCountEstimateQuery(state rivertype.JobState) (string, error) {
	switch state {
	case rivertype.JobStateAvailable:
		return jobCountEstimateAvailable, nil
	case rivertype.JobStateCancelled:
		return jobCountEstimateCancelled, nil
	case rivertype.JobStateCompleted:
		return jobCountEstimateCompleted, nil
	case rivertype.JobStateDiscarded:
		return jobCountEstimateDiscarded, nil
	case rivertype.JobStatePending:
		return jobCountEstimatePending, nil
	case rivertype.JobStateRetryable:
		return jobCountEstimateRetryable, nil
	case rivertype.JobStateRunning:
		return jobCountEstimateRunning, nil
	case rivertype.JobStateScheduled:
		return jobCountEstimateScheduled, nil
	default:
		return "", fmt.Errorf("invalid job state for count estimate: %q", state)
	}
}
