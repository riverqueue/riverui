package riverui

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

type noOpArgs struct {
	Name string `json:"name"`
}

func (noOpArgs) Kind() string { return "noOp" }

type noOpWorker struct {
	river.WorkerDefaults[noOpArgs]
}

func (w *noOpWorker) Work(_ context.Context, _ *river.Job[noOpArgs]) error { return nil }

func insertOnlyClient(t *testing.T, logger *slog.Logger) (*river.Client[pgx.Tx], riverdriver.Driver[pgx.Tx]) {
	t.Helper()

	workers := river.NewWorkers()
	river.AddWorker(workers, &noOpWorker{})

	driver := riverpgxv5.New(nil)

	client, err := river.NewClient(driver, &river.Config{
		Logger:  logger,
		Workers: workers,
	})
	require.NoError(t, err)

	return client, driver
}

func mustMarshalJSON(t *testing.T, v any) []byte {
	t.Helper()

	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

// Requires that err is an equivalent API error to expectedErr.
//
// TError is a pointer to an API error type like *apierror.NotFound.
func requireAPIError[TError error](t *testing.T, expectedErr TError, err error) {
	t.Helper()

	require.Error(t, err)
	var apiErr TError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, expectedErr, apiErr)
}
