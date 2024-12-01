package main

import (
	"crypto/subtle"
	"net/http"
	"os"
)

func installAuthMiddleware(next http.Handler) http.Handler {
	username := os.Getenv("RIVER_BASIC_AUTH_USER")
	password := os.Getenv("RIVER_BASIC_AUTH_PASS")

	if username == "" || password == "" {
		return next
	}

	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		if isReqAuthorized(req, username, password) {
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
