package apierror

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"riverqueue.com/riverui/internal/riverinternaltest"
)

func TestAPIError(t *testing.T) {
	t.Parallel()

	var (
		anErr  = errors.New("an error")
		apiErr = NewBadRequest("Bad request.")
	)

	apiErr.SetInternalError(anErr)
	require.Equal(t, anErr, apiErr.GetInternalError())
}

func TestAPIErrorJSON(t *testing.T) {
	t.Parallel()

	require.Equal(t,
		`{"message":"Bad request. Try sending JSON next time."}`,
		string(mustMarshalJSON(
			t, NewBadRequest("Bad request. Try sending JSON next time.")),
		),
	)
}

func TestAPIErrorWrite(t *testing.T) {
	t.Parallel()

	var (
		ctx      = context.Background()
		logger   = riverinternaltest.Logger(t)
		recorder = httptest.NewRecorder()
	)

	NewBadRequest("Bad request. Try sending JSON next time.").Write(ctx, logger, recorder)

	require.Equal(t, 400, recorder.Result().StatusCode) //nolint:bodyclose
	require.Equal(t,
		`{"message":"Bad request. Try sending JSON next time."}`,
		recorder.Body.String(),
	)
	require.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
}

func TestWithInternalError(t *testing.T) {
	t.Parallel()

	var (
		anErr  = errors.New("an error")
		apiErr = NewBadRequest("Bad request.")
	)

	apiErr = WithInternalError(apiErr, anErr)
	require.Equal(t, anErr, apiErr.InternalError)
}

func mustMarshalJSON(t *testing.T, v any) []byte {
	t.Helper()

	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}
