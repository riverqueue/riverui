package uicommontest

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
)

type NoOpArgs struct {
	Name string `json:"name"`
}

func (NoOpArgs) Kind() string { return "noOp" }

type NoOpWorker struct {
	river.WorkerDefaults[NoOpArgs]
}

func (w *NoOpWorker) Work(_ context.Context, _ *river.Job[NoOpArgs]) error { return nil }

func MustMarshalJSON(t *testing.T, v any) []byte {
	t.Helper()

	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

// Requires that err is an equivalent API error to expectedErr.
//
// TError is a pointer to an API error type like *apierror.NotFound.
func RequireAPIError[TError error](t *testing.T, expectedErr TError, err error) {
	t.Helper()

	require.Error(t, err)
	var apiErr TError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, expectedErr, apiErr)
}
