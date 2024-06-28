package apiendpoint

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/riverui/internal/apierror"
	"github.com/riverqueue/riverui/internal/riverinternaltest"
)

func TestMountAndServe(t *testing.T) {
	t.Parallel()

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

	t.Run("APIError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint", nil)
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusBadRequest, &apierror.APIError{Message: "Missing message value."}, bundle.recorder)
	})

	t.Run("InternalServerError", func(t *testing.T) {
		t.Parallel()

		mux, bundle := setup(t)

		req := httptest.NewRequest(http.MethodPost, "/api/post-endpoint",
			bytes.NewBuffer(mustMarshalJSON(t, &postRequest{MakeInternalError: true})))
		mux.ServeHTTP(bundle.recorder, req)

		requireStatusAndJSONResponse(t, http.StatusInternalServerError, &apierror.APIError{Message: "Internal server error. Check logs for more information."}, bundle.recorder)
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
	IgnoredJSONMessage string `json:"ignored_json"`
	Message            string `json:"-"`
}

func (req *getRequest) ExtractRaw(r *http.Request) error {
	req.Message = r.PathValue("message")
	return nil
}

type getResponse struct {
	Message string `json:"message"`
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
	MakeInternalError bool   `json:"make_internal_error"`
	Message           string `json:"message"`
}

type postResponse struct {
	Message string `json:"message"`
}

func (a *postEndpoint) Execute(_ context.Context, req *postRequest) (*postResponse, error) {
	if req.MakeInternalError {
		return nil, errors.New("an internal error occurred")
	}

	if req.Message == "" {
		return nil, apierror.NewBadRequest("Missing message value.")
	}

	return &postResponse{Message: req.Message}, nil
}
