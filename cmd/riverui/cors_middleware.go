package main

import (
	"net/http"
	"os"
	"strings"

	"github.com/rs/cors"
)

func installCorsMiddleware(next http.Handler) http.Handler {
	origins := strings.Split(os.Getenv("CORS_ORIGINS"), ",")

	handler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: origins,
	})

	return handler.Handler(next)
}
