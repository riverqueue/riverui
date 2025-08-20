package riverui

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"riverqueue.com/riverui/internal/uicommontest"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

func insertOnlyClient(t *testing.T, logger *slog.Logger) (*river.Client[pgx.Tx], riverdriver.Driver[pgx.Tx]) {
	t.Helper()

	workers := river.NewWorkers()
	river.AddWorker(workers, &uicommontest.NoOpWorker{})

	driver := riverpgxv5.New(nil)

	client, err := river.NewClient(driver, &river.Config{
		Logger:  logger,
		Workers: workers,
	})
	require.NoError(t, err)

	return client, driver
}
