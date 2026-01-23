package riverui

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestServeIndexHTMLAcceptNegotiation(t *testing.T) {
	t.Parallel()

	files := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<html>ok</html>")},
	}

	handler := serveIndexHTML(false, map[string]any{}, "/riverui", http.FS(files))

	tests := []struct {
		name         string
		acceptHeader string
		setAccept    bool
		wantStatus   int
	}{
		{
			name:         "AcceptHTML",
			acceptHeader: "text/html",
			setAccept:    true,
			wantStatus:   http.StatusOK,
		},
		{
			name:         "AcceptWildcard",
			acceptHeader: "*/*",
			setAccept:    true,
			wantStatus:   http.StatusOK,
		},
		{
			name:         "AcceptTextWildcard",
			acceptHeader: "text/*",
			setAccept:    true,
			wantStatus:   http.StatusOK,
		},
		{
			name:       "AcceptMissing",
			setAccept:  false,
			wantStatus: http.StatusOK,
		},
		{
			name:         "AcceptJSON",
			acceptHeader: "application/json",
			setAccept:    true,
			wantStatus:   http.StatusNotAcceptable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.setAccept {
				req.Header.Set("Accept", tt.acceptHeader)
			}

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			require.Equal(t, tt.wantStatus, recorder.Result().StatusCode)
		})
	}
}
