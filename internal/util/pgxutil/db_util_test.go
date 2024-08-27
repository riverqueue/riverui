package pgxutil

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"riverqueue.com/riverui/internal/riverinternaltest"
)

func TestWithTx(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tx := riverinternaltest.TestTx(ctx, t)

	err := WithTx(ctx, tx, func(ctx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "SELECT 1")
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)
}

func TestWithTxV(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tx := riverinternaltest.TestTx(ctx, t)

	ret, err := WithTxV(ctx, tx, func(ctx context.Context, tx pgx.Tx) (int, error) {
		_, err := tx.Exec(ctx, "SELECT 1")
		require.NoError(t, err)

		return 7, nil
	})
	require.NoError(t, err)
	require.Equal(t, 7, ret)
}
