package main

import (
	"crypto/subtle"
	"net/http"
)

type authMiddleware struct {
	username string
	password string
}

func (m *authMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		if isReqAuthorized(req, m.username, m.password) {
			next.ServeHTTP(res, req)
			return
		}

		res.Header().Set("WWW-Authenticate", "Basic realm=\"riverui\"")
		http.Error(res, "Unauthorized", http.StatusUnauthorized)
	})
}

func isReqAuthorized(req *http.Request, username, password string) bool {
	reqUsername, reqPassword, ok := req.BasicAuth()

	return ok &&
		subtle.ConstantTimeCompare([]byte(reqUsername), []byte(username)) == 1 &&
		subtle.ConstantTimeCompare([]byte(reqPassword), []byte(password)) == 1
}
