package main

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

type authMiddleware struct {
	password   string
	pathPrefix string // HTTP path prefix
	username   string
}

func (m *authMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		if m.isReqAuthorized(req) {
			next.ServeHTTP(res, req)
			return
		}

		res.Header().Set("WWW-Authenticate", "Basic realm=\"riverui\"")
		http.Error(res, "Unauthorized", http.StatusUnauthorized)
	})
}

func (m *authMiddleware) isReqAuthorized(req *http.Request) bool {
	if strings.HasPrefix(req.URL.Path, m.pathPrefix+"/api/health-checks/") {
		return true
	}

	reqUsername, reqPassword, ok := req.BasicAuth()
	return ok &&
		subtle.ConstantTimeCompare([]byte(reqUsername), []byte(m.username)) == 1 &&
		subtle.ConstantTimeCompare([]byte(reqPassword), []byte(m.password)) == 1
}
