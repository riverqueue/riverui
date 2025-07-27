package authmiddleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBasicAuth_Middleware(t *testing.T) {
	t.Parallel()

	username := "user"
	password := "pass"
	auth := BasicAuth{Username: username, Password: password}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte("OK"))
		require.NoError(t, err)
	})

	handler := auth.Middleware(next)

	tests := []struct {
		name                   string
		setupRequest           func(req *http.Request)
		wantStatus             int
		wantBody               string
		wantAuthenticateHeader bool
	}{
		{
			name: "authorized",
			setupRequest: func(req *http.Request) {
				req.SetBasicAuth(username, password)
			},
			wantStatus:             http.StatusOK,
			wantBody:               "OK",
			wantAuthenticateHeader: false,
		},
		{
			name: "wrong username",
			setupRequest: func(req *http.Request) {
				req.SetBasicAuth("wrong", password)
			},
			wantStatus:             http.StatusUnauthorized,
			wantBody:               "Unauthorized\n",
			wantAuthenticateHeader: true,
		},
		{
			name: "wrong password",
			setupRequest: func(req *http.Request) {
				req.SetBasicAuth(username, "wrong")
			},
			wantStatus:             http.StatusUnauthorized,
			wantBody:               "Unauthorized\n",
			wantAuthenticateHeader: true,
		},
		{
			name:                   "no auth",
			setupRequest:           func(req *http.Request) {},
			wantStatus:             http.StatusUnauthorized,
			wantBody:               "Unauthorized\n",
			wantAuthenticateHeader: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			tt.setupRequest(req)

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			require.Equal(t, tt.wantStatus, rec.Code)

			require.Equal(t, tt.wantBody, rec.Body.String())

			header := rec.Header().Get("WWW-Authenticate")
			if tt.wantAuthenticateHeader {
				require.Equal(t, `Basic realm="riverui"`, header)
			} else {
				require.Empty(t, header)
			}
		})
	}
}

func Test_isReqAuthorized(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		reqUser  string
		reqPass  string
		hasAuth  bool
		username string
		password string
		want     bool
	}{
		{"matching", "user", "pass", true, "user", "pass", true},
		{"wrong user", "wrong", "pass", true, "user", "pass", false},
		{"wrong pass", "user", "wrong", true, "user", "pass", false},
		{"no auth", "", "", false, "user", "pass", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.hasAuth {
				req.SetBasicAuth(tt.reqUser, tt.reqPass)
			}

			got := isReqAuthorized(req, tt.username, tt.password)
			require.Equal(t, tt.want, got)
		})
	}
}
