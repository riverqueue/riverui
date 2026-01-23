package riverui

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestServeIndexHTMLAcceptNegotiation(t *testing.T) {
	t.Parallel()

	handler := serveIndexHTML(false, map[string]any{}, "/riverui", newIndexFileSystem())

	tests := []struct {
		name          string
		acceptHeaders []string
		wantStatus    int
	}{
		{
			name:          "AcceptHTML",
			acceptHeaders: []string{"text/html"},
			wantStatus:    http.StatusOK,
		},
		{
			name:          "AcceptWildcard",
			acceptHeaders: []string{"*/*"},
			wantStatus:    http.StatusOK,
		},
		{
			name:          "AcceptTextWildcard",
			acceptHeaders: []string{"text/*"},
			wantStatus:    http.StatusOK,
		},
		{
			name:       "AcceptMissing",
			wantStatus: http.StatusOK,
		},
		{
			name:          "AcceptJSON",
			acceptHeaders: []string{"application/json"},
			wantStatus:    http.StatusNotAcceptable,
		},
		{
			name:          "AcceptXHTML",
			acceptHeaders: []string{"application/xhtml+xml"},
			wantStatus:    http.StatusOK,
		},
		{
			name:          "AcceptHTMLWithQualityZero",
			acceptHeaders: []string{"text/html;q=0"},
			wantStatus:    http.StatusNotAcceptable,
		},
		{
			name:          "AcceptMultipleHeaders",
			acceptHeaders: []string{"application/json", "text/html"},
			wantStatus:    http.StatusOK,
		},
		{
			name:          "AcceptMultipleValues",
			acceptHeaders: []string{"application/json, text/html"},
			wantStatus:    http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			recorder := performRequest(handler, http.MethodGet, tt.acceptHeaders)
			require.Equal(t, tt.wantStatus, recorder.Result().StatusCode)
		})
	}
}

func TestServeIndexHTMLVaryHeader(t *testing.T) {
	t.Parallel()

	handler := serveIndexHTML(false, map[string]any{}, "/riverui", newIndexFileSystem())

	recorder := performRequest(handler, http.MethodGet, []string{"application/json"})
	require.Equal(t, http.StatusNotAcceptable, recorder.Result().StatusCode)
	require.Contains(t, strings.Join(recorder.Header().Values("Vary"), ","), "Accept")
}

func TestServeIndexHTMLMethodNotAllowed(t *testing.T) {
	t.Parallel()

	handler := serveIndexHTML(false, map[string]any{}, "/riverui", newIndexFileSystem())

	recorder := performRequest(handler, http.MethodPost, []string{"text/html"})
	require.Equal(t, http.StatusMethodNotAllowed, recorder.Result().StatusCode)
	require.Contains(t, recorder.Header().Get("Allow"), "GET")
	require.Contains(t, recorder.Header().Get("Allow"), "HEAD")
}

func TestServeIndexHTMLHead(t *testing.T) {
	t.Parallel()

	handler := serveIndexHTML(false, map[string]any{}, "/riverui", newIndexFileSystem())

	recorder := performRequest(handler, http.MethodHead, []string{"text/html"})
	require.Equal(t, http.StatusOK, recorder.Result().StatusCode)
	require.Empty(t, recorder.Body.String())
}

func TestServeIndexHTMLTemplateCaching(t *testing.T) {
	t.Parallel()

	t.Run("CachesWhenNotDevMode", func(t *testing.T) {
		t.Parallel()

		counting := &countingFS{fs: newIndexFileSystem()}
		handler := serveIndexHTML(false, map[string]any{}, "/riverui", counting)

		require.Equal(t, http.StatusOK, performRequest(handler, http.MethodGet, []string{"text/html"}).Result().StatusCode)
		require.Equal(t, http.StatusOK, performRequest(handler, http.MethodGet, []string{"text/html"}).Result().StatusCode)

		require.Equal(t, int32(1), counting.opens.Load())
	})

	t.Run("NoCacheInDevMode", func(t *testing.T) {
		t.Parallel()

		counting := &countingFS{fs: newIndexFileSystem()}
		handler := serveIndexHTML(true, map[string]any{}, "/riverui", counting)

		require.Equal(t, http.StatusOK, performRequest(handler, http.MethodGet, []string{"text/html"}).Result().StatusCode)
		require.Equal(t, http.StatusOK, performRequest(handler, http.MethodGet, []string{"text/html"}).Result().StatusCode)

		require.Equal(t, int32(2), counting.opens.Load())
	})
}

func performRequest(handler http.Handler, method string, acceptHeaders []string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/", nil)
	for _, header := range acceptHeaders {
		req.Header.Add("Accept", header)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	return recorder
}

func newIndexFileSystem() http.FileSystem {
	files := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<html>ok</html>")},
	}

	return http.FS(files)
}

type countingFS struct {
	fs    http.FileSystem
	opens atomic.Int32
}

func (counting *countingFS) Open(name string) (http.File, error) {
	counting.opens.Add(1)
	return counting.fs.Open(name)
}
