package apiendpoint

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"

	"riverqueue.com/riverui/internal/apierror"
	"riverqueue.com/riverui/internal/riverinternaltest"
)

func TestMountAndServe(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	type testBundle struct {
		recorder *httptest.ResponseRecorder
	}

	setup := func(t *testing.T) (*http.ServeMux, *testBundle) {
		t.Helper()

		var (
			logger = riverinternaltest.Logger(t)
			mux    = http.NewServeMux()
		)

		Mount(mux, logger, &getEndpoint{})
		Mount(mux, logger, &postEndpoint{})

		return mux, &testBundle{
			recorder: httptest.NewRecorder(),
		}
	}

	t.Run("GetEndpointAndExtractRaw", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodGet, "/api/get-endpoint/Hello.", nil)
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusOK, &postResponse{Message: "Hello."}, bundle.recorder)
	})

	t.Run("BodyIgnoredOnGet", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodGet, "/api/get-endpoint/Hello.",
			bytes.NewBuffer(mustMarshalJSON(t, &getRequest{IgnoredJSONMessage: "Ignored hello."})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusOK, &postResponse{Message: "Hello."}, bundle.recorder)
	})

	t.Run("MethodNotAllowed", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/get-endpoint/Hello.", nil)
		mux.ServeHTTP(bundle.recorder, req)

		// This error comes from net/http.
		requireStatusAndResponse(t, http.StatusMethodNotAllowed, "Method Not Allowed\n", bundle.recorder)
	})

	t.Run("PostEndpoint", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{Message: "Hello."})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusCreated, &postResponse{Message: "Hello."}, bundle.recorder)
	})

	t.Run("ValidationError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint", nil)
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusBadRequest, &apierror.APIError{Message: "Field `message` is required."}, bundle.recorder)
	})

	t.Run("APIError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{MakeAPIError: true, Message: "Hello."})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusBadRequest, &apierror.APIError{Message: "Bad request."}, bundle.recorder)
	})

	t.Run("InterpretedError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{MakePostgresError: true, Message: "Hello."})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusBadRequest, &apierror.APIError{Message: "Insufficient database privilege to perform this operation."}, bundle.recorder)
	})

	t.Run("Timeout", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		ctx, cancel := context.WithDeadline(ctx, time.Now())
		t.Cleanup(cancel)

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{Message: "Hello."})))
		require.NoError(t, err)
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusServiceUnavailable, &apierror.APIError{Message: "Request timed out. Retrying the request might work."}, bundle.recorder)
	})

	t.Run("InternalServerError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{MakeInternalError: true, Message: "Hello."})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusInternalServerError, &apierror.APIError{Message: "Internal server error. Check logs for more information."}, bundle.recorder)
	})
}

func TestMaybeInterpretInternalError(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("ConnectError", func(t *testing.T) {
		t.Parallel()

		_, err := pgconn.Connect(ctx, "postgres://user@127.0.0.1:37283/does_not_exist")

		require.Equal(t, apierror.WithInternalError(apierror.NewBadRequest("There was a problem connecting to the configured database. Check logs for details."), err), maybeInterpretInternalError(err))
	})

	t.Run("ConnectError", func(t *testing.T) {
		t.Parallel()

		err := &pgconn.PgError{Code: pgerrcode.InsufficientPrivilege}

		require.Equal(t, apierror.WithInternalError(apierror.NewBadRequest("Insufficient database privilege to perform this operation."), err), maybeInterpretInternalError(err))
	})

	t.Run("OtherPGError", func(t *testing.T) {
		t.Parallel()

		err := &pgconn.PgError{Code: pgerrcode.CardinalityViolation}

		require.Equal(t, err, maybeInterpretInternalError(err))
	})

	t.Run("ConnectError", func(t *testing.T) {
		t.Parallel()

		err := errors.New("other error")

		require.Equal(t, err, maybeInterpretInternalError(err))
	})
}

func mustMarshalJSON(t *testing.T, v any) []byte {
	t.Helper()

	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

func mustUnmarshalJSON[T any](t *testing.T, data []byte) *T {
	t.Helper()

	var val T
	err := json.Unmarshal(data, &val)
	require.NoError(t, err)
	return &val
}

// Shortcut for requiring an HTTP status code and a JSON-marshaled response
// equivalent to expectedResp. The important thing that is does is that in the
// event of a failure on status code, it prints the response body as additional
// context to help debug the problem.
func requireStatusAndJSONResponse[T any](t *testing.T, expectedStatusCode int, expectedResp *T, recorder *httptest.ResponseRecorder) {
	t.Helper()

	require.Equal(t, expectedStatusCode, recorder.Result().StatusCode, "Unexpected status code; response body: %s", recorder.Body.String()) //nolint:bodyclose
	require.Equal(t, expectedResp, mustUnmarshalJSON[T](t, recorder.Body.Bytes()))
	require.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
}

// Same as the above, but for a non-JSON response.
func requireStatusAndResponse(t *testing.T, expectedStatusCode int, expectedResp string, recorder *httptest.ResponseRecorder) {
	t.Helper()

	require.Equal(t, expectedStatusCode, recorder.Result().StatusCode, "Unexpected status code; response body: %s", recorder.Body.String()) //nolint:bodyclose
	require.Equal(t, expectedResp, recorder.Body.String())
}

//
// getEndpoint
//

type getEndpoint struct {
	Endpoint[getRequest, getResponse]
}

func (*getEndpoint) Meta() *EndpointMeta {
	return &EndpointMeta{
		Pattern:    "GET /api/get-endpoint/{message}",
		StatusCode: http.StatusOK,
	}
}

type getRequest struct {
	IgnoredJSONMessage string `json:"ignored_json" validate:"-"`
	Message            string `json:"-"            validate:"required"`
}

func (req *getRequest) ExtractRaw(r *http.Request) error {
	req.Message = r.PathValue("message")
	return nil
}

type getResponse struct {
	Message string `json:"message" validate:"required"`
}

func (a *getEndpoint) Execute(_ context.Context, req *getRequest) (*getResponse, error) {
	// This branch never gets taken because request bodies are ignored on GET.
	if req.IgnoredJSONMessage != "" {
		return &getResponse{Message: req.IgnoredJSONMessage}, nil
	}

	return &getResponse{Message: req.Message}, nil
}

//
// postEndpoint
//

type postEndpoint struct {
	Endpoint[postRequest, postResponse]
}

func (*postEndpoint) Meta() *EndpointMeta {
	return &EndpointMeta{
		Pattern:    "POST /api/post-endpoint",
		StatusCode: http.StatusCreated,
	}
}

type postRequest struct {
	MakeAPIError      bool   `json:"make_api_error"      validate:"-"`
	MakeInternalError bool   `json:"make_internal_error" validate:"-"`
	MakePostgresError bool   `json:"make_postgres_error" validate:"-"`
	Message           string `json:"message"             validate:"required"`
}

type postResponse struct {
	Message string `json:"message"`
}

func (a *postEndpoint) Execute(ctx context.Context, req *postRequest) (*postResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if req.MakeAPIError {
		return nil, apierror.NewBadRequest("Bad request.")
	}

	if req.MakeInternalError {
		return nil, errors.New("an internal error occurred")
	}

	if req.MakePostgresError {
		// Wrap the error to make it more realistic.
		return nil, fmt.Errorf("error runnning Postgres query: %w", &pgconn.PgError{Code: pgerrcode.InsufficientPrivilege})
	}

	return &postResponse{Message: req.Message}, nil
}
