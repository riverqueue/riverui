package pgxutil

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type TxBegin interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// WithTx starts and commits a transaction on a driver executor around
// the given function, allowing the return of a generic value.
func WithTx(ctx context.Context, txBegin TxBegin, innerFunc func(ctx context.Context, tx pgx.Tx) error) error {
	_, err := WithTxV(ctx, txBegin, func(ctx context.Context, tx pgx.Tx) (struct{}, error) {
		return struct{}{}, innerFunc(ctx, tx)
	})
	return err
}

// WithTxV starts and commits a transaction on a driver executor around
// the given function, allowing the return of a generic value.
func WithTxV[T any](ctx context.Context, txBegin TxBegin, innerFunc func(ctx context.Context, exec pgx.Tx) (T, error)) (T, error) {
	var defaultRes T

	tx, err := txBegin.Begin(ctx)
	if err != nil {
		return defaultRes, fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	res, err := innerFunc(ctx, tx)
	if err != nil {
		return defaultRes, err
	}

	if err := tx.Commit(ctx); err != nil {
		return defaultRes, fmt.Errorf("error committing transaction: %w", err)
	}

	return res, nil
}
