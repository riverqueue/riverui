package dbsqlc

import "context"

// Row and RowQuerier avoid coupling these read-only generated queries to
// database/sql's concrete *sql.Row return type. River's executor deliberately
// exposes the same minimal Scan contract across database implementations.
type Row interface {
	Scan(dest ...any) error
}

type RowQuerier interface {
	QueryRow(ctx context.Context, query string, args ...any) Row
}

func JobCountByAllStatesCappedRiver(ctx context.Context, db RowQuerier, maxRows int64) (*JobCountByAllStatesCappedRow, error) {
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

func JobCountEstimateStat4River(ctx context.Context, db RowQuerier) (string, error) {
	var samples string
	if err := db.QueryRow(ctx, jobCountEstimateStat4).Scan(&samples); err != nil {
		return "", err
	}
	return samples, nil
}
