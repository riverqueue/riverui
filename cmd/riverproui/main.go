package main

import (
	"cmp"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	sloghttp "github.com/samber/slog-http"

	"github.com/riverqueue/apiframe/apimiddleware"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver/riverpropgxv5"
	"riverqueue.com/riverui"
	"riverqueue.com/riverui/authmiddleware"
)

func main() {
	ctx := context.Background()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: getLogLevel(),
	}))

	var pathPrefix string
	flag.StringVar(&pathPrefix, "prefix", "/", "path prefix to use for the API and UI HTTP requests")
	flag.Parse()

	initRes, err := initServer(ctx, logger, pathPrefix)
	if err != nil {
		logger.ErrorContext(ctx, "Error initializing server", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := startAndListen(ctx, logger, initRes); err != nil {
		logger.ErrorContext(ctx, "Error starting server", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

// Translates either a "1" or "true" from env to a Go boolean.
func envBooleanTrue(val string) bool {
	return val == "1" || val == "true"
}

func getLogLevel() slog.Level {
	if envBooleanTrue(os.Getenv("RIVER_DEBUG")) {
		return slog.LevelDebug
	}

	switch strings.ToLower(os.Getenv("RIVER_LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

type initServerResult struct {
	dbPool     *pgxpool.Pool   // database pool; close must be deferred by caller!
	httpServer *http.Server    // HTTP server wrapping the UI server
	logger     *slog.Logger    // application logger (also internalized in UI server)
	uiServer   *riverui.Server // River UI server
}

func initServer(ctx context.Context, logger *slog.Logger, pathPrefix string) (*initServerResult, error) {
	if !strings.HasPrefix(pathPrefix, "/") || pathPrefix == "" {
		return nil, fmt.Errorf("invalid path prefix: %s", pathPrefix)
	}
	pathPrefix = riverui.NormalizePathPrefix(pathPrefix)

	var (
		basicAuthUsername        = os.Getenv("RIVER_BASIC_AUTH_USER")
		basicAuthPassword        = os.Getenv("RIVER_BASIC_AUTH_PASS")
		corsOrigins              = strings.Split(os.Getenv("CORS_ORIGINS"), ",")
		databaseURL              = os.Getenv("DATABASE_URL")
		devMode                  = envBooleanTrue(os.Getenv("DEV"))
		jobListHideArgsByDefault = envBooleanTrue(os.Getenv("RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT"))
		host                     = os.Getenv("RIVER_HOST") // may be left empty to bind to all local interfaces
		liveFS                   = envBooleanTrue(os.Getenv("LIVE_FS"))
		otelEnabled              = envBooleanTrue(os.Getenv("OTEL_ENABLED"))
		port                     = cmp.Or(os.Getenv("PORT"), "8080")
	)

	if databaseURL == "" && os.Getenv("PGDATABASE") == "" {
		return nil, errors.New("expect to have DATABASE_URL or database configuration in standard PG* env vars like PGDATABASE/PGHOST/PGPORT/PGUSER/PGPASSWORD")
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing db config: %w", err)
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("error connecting to db: %w", err)
	}

	proClient, err := riverpro.NewClient(riverpropgxv5.New(dbPool), &riverpro.Config{})
	if err != nil {
		return nil, err
	}

	uiServer, err := riverui.NewServer(&riverui.ServerOpts{
		Client:                   proClient.Client,
		DB:                       dbPool,
		DevMode:                  devMode,
		JobListHideArgsByDefault: jobListHideArgsByDefault,
		LiveFS:                   liveFS,
		Logger:                   logger,
		Prefix:                   pathPrefix,
	})
	if err != nil {
		return nil, err
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
		middlewareStack.Use(&authmiddleware.BasicAuth{Username: basicAuthUsername, Password: basicAuthPassword})
	}

	return &initServerResult{
		dbPool: dbPool,
		httpServer: &http.Server{
			Addr:              host + ":" + port,
			Handler:           middlewareStack.Mount(uiServer),
			ReadHeaderTimeout: 5 * time.Second,
		},
		logger:   logger,
		uiServer: uiServer,
	}, nil
}

func startAndListen(ctx context.Context, logger *slog.Logger, initRes *initServerResult) error {
	defer initRes.dbPool.Close()

	if err := initRes.uiServer.Start(ctx); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Starting server", slog.String("addr", initRes.httpServer.Addr))

	if err := initRes.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}
