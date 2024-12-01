package main

import (
	sloghttp "github.com/samber/slog-http"
	"net/http"
	"os"
)

func installLoggerMiddleware(next http.Handler) http.Handler {
	otelEnabled := os.Getenv("OTEL_ENABLED") == "true"

	return sloghttp.NewWithConfig(logger, sloghttp.Config{
		WithSpanID:  otelEnabled,
		WithTraceID: otelEnabled,
	})(next)
}
