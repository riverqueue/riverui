package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	sloghttp "github.com/samber/slog-http"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/riverui/internal/db"
	"github.com/riverqueue/riverui/ui"
)

var logger *slog.Logger //nolint:gochecknoglobals

func main() {
	ctx := context.Background()
	if err := godotenv.Load(); err != nil {
		fmt.Printf("No .env file detected, using environment variables\n")
	}
	logger = slog.New(slog.NewTextHandler(os.Stdout, nil))

	os.Exit(initAndServe(ctx))
}

func initAndServe(ctx context.Context) int {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	corsOriginString := os.Getenv("CORS_ORIGINS")
	corsOrigins := strings.Split(corsOriginString, ",")
	dbURL := mustEnv("DATABASE_URL")
	otelEnabled := os.Getenv("OTEL_ENABLED") == "true"
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	frontendIndex, err := fs.Sub(ui.Index, "dist")
	if err != nil {
		logger.ErrorContext(ctx, "error getting frontend index", slog.String("error", err.Error()))
		return 1
	}
	httpFS := http.FS(frontendIndex)
	fileServer := http.FileServer(httpFS)
	serveIndex := serveFileContents("index.html", httpFS)

	dbPool, err := getDBPool(ctx, dbURL)
	if err != nil {
		logger.ErrorContext(ctx, "error connecting to db", slog.String("error", err.Error()))
		return 1
	}
	defer dbPool.Close()

	corsHandler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: corsOrigins,
	})

	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
	if err != nil {
		logger.ErrorContext(ctx, "error creating river client", slog.String("error", err.Error()))
		return 1
	}
	handler := &apiHandler{client: client, dbPool: dbPool, queries: db.New(dbPool)}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/jobs", handler.JobList)
	mux.HandleFunc("POST /api/jobs/cancel", handler.JobCancel)
	mux.HandleFunc("POST /api/jobs/retry", handler.JobRetry)
	mux.HandleFunc("GET /api/jobs/{id}", handler.JobGet)
	mux.HandleFunc("GET /api/queues", handler.QueueList)
	mux.HandleFunc("GET /api/queues/{name}", handler.QueueGet)
	mux.HandleFunc("PUT /api/queues/{name}/pause", handler.QueuePause)
	mux.HandleFunc("PUT /api/queues/{name}/resume", handler.QueueResume)
	mux.HandleFunc("GET /api/workflows/{id}", handler.WorkflowGet)
	mux.HandleFunc("GET /api/states", handler.StatesAndCounts)
	mux.HandleFunc("/api", http.NotFound)
	mux.Handle("/", intercept404(fileServer, serveIndex))

	logHandler := sloghttp.Recovery(mux)
	config := sloghttp.Config{
		WithSpanID:  otelEnabled,
		WithTraceID: otelEnabled,
	}
	wrappedHandler := sloghttp.NewWithConfig(logger, config)(corsHandler.Handler(logHandler))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           wrappedHandler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("starting server on %s", srv.Addr)

	if err = srv.ListenAndServe(); err != nil && errors.Is(err, http.ErrServerClosed) {
		logger.ErrorContext(ctx, "error from ListenAndServe", slog.String("error", err.Error()))
		return 1
	}

	return 0
}

func getDBPool(ctx context.Context, dbURL string) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing db config: %w", err)
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("error connecting to db: %w", err)
	}
	return dbPool, nil
}

func mustEnv(name string) string {
	val := os.Getenv(name)
	if val == "" {
		logger.Error("missing required env var", slog.String("name", name))
		os.Exit(1)
	}
	return val
}
