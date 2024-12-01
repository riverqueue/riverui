package main

import (
	"cmp"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	sloghttp "github.com/samber/slog-http"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/apimiddleware"
)

func main() {
	ctx := context.Background()
	initLogger()
	os.Exit(initAndServe(ctx))
}

func initAndServe(ctx context.Context) int {
	var (
		devMode    bool
		liveFS     bool
		pathPrefix string
	)
	_, liveFS = os.LookupEnv("LIVE_FS")
	_, devMode = os.LookupEnv("DEV")

	flag.StringVar(&pathPrefix, "prefix", "/", "path prefix to use for the API and UI HTTP requests")
	flag.Parse()

	if !strings.HasPrefix(pathPrefix, "/") || pathPrefix == "" {
		logger.ErrorContext(ctx, "invalid path prefix", slog.String("prefix", pathPrefix))
		return 1
	}
	pathPrefix = riverui.NormalizePathPrefix(pathPrefix)

	var (
		basicAuthUsername = os.Getenv("RIVER_BASIC_AUTH_USER")
		basicAuthPassword = os.Getenv("RIVER_BASIC_AUTH_PASS")
		corsOrigins       = strings.Split(os.Getenv("CORS_ORIGINS"), ",")
		dbURL             = mustEnv("DATABASE_URL")
		host              = os.Getenv("RIVER_HOST") // may be left empty to bind to all local interfaces
		otelEnabled       = os.Getenv("OTEL_ENABLED") == "true"
		port              = cmp.Or(os.Getenv("PORT"), "8080")
	)

	dbPool, err := getDBPool(ctx, dbURL)
	if err != nil {
		logger.ErrorContext(ctx, "error connecting to db", slog.String("error", err.Error()))
		return 1
	}
	defer dbPool.Close()

	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
	if err != nil {
		logger.ErrorContext(ctx, "error creating river client", slog.String("error", err.Error()))
		return 1
	}

	handlerOpts := &riverui.ServerOpts{
		Client:  client,
		DB:      dbPool,
		DevMode: devMode,
		LiveFS:  liveFS,
		Logger:  logger,
		Prefix:  pathPrefix,
	}

	server, err := riverui.NewServer(handlerOpts)
	if err != nil {
		logger.ErrorContext(ctx, "error creating handler", slog.String("error", err.Error()))
		return 1
	}

	if err = server.Start(ctx); err != nil {
		logger.ErrorContext(ctx, "error starting UI server", slog.String("error", err.Error()))
		return 1
	}

	corsHandler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: corsOrigins,
	})
	logHandler := sloghttp.NewWithConfig(logger, sloghttp.Config{
		WithSpanID:  otelEnabled,
		WithTraceID: otelEnabled,
	})

	middlewareStack := apimiddleware.NewMiddlewareStack(
		apimiddleware.MiddlewareFunc(sloghttp.Recovery),
		apimiddleware.MiddlewareFunc(corsHandler.Handler),
		apimiddleware.MiddlewareFunc(logHandler),
	)
	if basicAuthUsername != "" && basicAuthPassword != "" {
		middlewareStack.Use(&authMiddleware{username: basicAuthUsername, password: basicAuthPassword})
	}

	srv := &http.Server{
		Addr:              host + ":" + port,
		Handler:           middlewareStack.Mount(server),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("starting server on %s", srv.Addr)

	if err = srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
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
