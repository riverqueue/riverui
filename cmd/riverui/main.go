package main

import (
	"cmp"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	sloghttp "github.com/samber/slog-http"
	"riverqueue.com/riverui"

	"github.com/riverqueue/apiframe/apimiddleware"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

func main() {
	ctx := context.Background()

	logger := slog.New(getLogHandler(&slog.HandlerOptions{
		Level: getLogLevel(),
	}))

	var pathPrefix string
	flag.StringVar(&pathPrefix, "prefix", "/", "path prefix to use for the API and UI HTTP requests")

	var healthCheckName string
	flag.StringVar(&healthCheckName, "healthcheck", "", "the name of the health checks: minimal or complete")

	flag.Parse()

	if healthCheckName != "" {
		if err := checkHealth(ctx, pathPrefix, healthCheckName); err != nil {
			logger.ErrorContext(ctx, "Error checking for server health", slog.String("error", err.Error()))
			os.Exit(1)
		}
		os.Exit(0)
	}

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

func getLogHandler(opts *slog.HandlerOptions) slog.Handler {
	logFormat := strings.ToLower(os.Getenv("RIVER_LOG_FORMAT"))
	switch logFormat {
	case "json":
		return slog.NewJSONHandler(os.Stdout, opts)
	default:
		return slog.NewTextHandler(os.Stdout, opts)
	}
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

	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
	if err != nil {
		return nil, err
	}

	uiServer, err := riverui.NewServer(&riverui.ServerOpts{
		Client:                   client,
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
		middlewareStack.Use(&authMiddleware{username: basicAuthUsername, password: basicAuthPassword, pathPrefix: pathPrefix})
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

func checkHealth(ctx context.Context, pathPrefix string, healthCheckName string) error {
	host := cmp.Or(os.Getenv("RIVER_HOST"), "localhost")
	port := cmp.Or(os.Getenv("PORT"), "8080")
	pathPrefix = riverui.NormalizePathPrefix(pathPrefix)
	hostname := net.JoinHostPort(host, port)
	url := fmt.Sprintf("http://%s%s/api/health-checks/%s", hostname, pathPrefix, healthCheckName)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("error constructing request to health endpoint: %w", err)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("error requesting health endpoint: %w", err)
	}

	err = response.Body.Close()
	if err != nil {
		return fmt.Errorf("error closing health endpoint response body: %w", err)
	}

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("health endpoint returned status code %d instead of 200", response.StatusCode)
	}
	return nil
}
