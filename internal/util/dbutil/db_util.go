package dbutil

import (
	"context"
	"fmt"

	"github.com/riverqueue/river/riverdriver"
)

// WithTx starts and commits a transaction on a driver executor around
// the given function, allowing the return of a generic value.
func WithTx[TTx any](ctx context.Context, driver riverdriver.Driver[TTx], executor riverdriver.Executor, innerFunc func(ctx context.Context, tx TTx) error) error {
	_, err := WithTxV(ctx, driver, executor, func(ctx context.Context, tx TTx) (struct{}, error) {
		return struct{}{}, innerFunc(ctx, tx)
	})
	return err
}

// WithTxV starts and commits a transaction on a driver executor around
// the given function, allowing the return of a generic value.
func WithTxV[T any, TTx any](ctx context.Context, driver riverdriver.Driver[TTx], executor riverdriver.Executor, innerFunc func(ctx context.Context, tx TTx) (T, error)) (T, error) {
	var defaultRes T

	execTx, err := executor.Begin(ctx)
	if err != nil {
		return defaultRes, fmt.Errorf("error beginning transaction: %w", err)
	}
	defer execTx.Rollback(ctx)

	tx := driver.UnwrapTx(execTx)

	res, err := innerFunc(ctx, tx)
	if err != nil {
		return defaultRes, err
	}

	if err := execTx.Commit(ctx); err != nil {
		return defaultRes, fmt.Errorf("error committing transaction: %w", err)
	}

	return res, nil
}
