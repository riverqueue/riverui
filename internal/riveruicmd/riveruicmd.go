package riveruicmd

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

	"github.com/riverqueue/apiframe/apimiddleware"

	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/authmiddleware"
	"riverqueue.com/riverui/uiendpoints"
)

type BundleOpts struct {
	JobListHideArgsByDefault bool
}

func Run[TClient any](createClient func(dbPool *pgxpool.Pool, schema string) (TClient, error), createBundle func(TClient) uiendpoints.Bundle) {
	ctx := context.Background()

	logger := slog.New(getLogHandler(&slog.HandlerOptions{
		Level: getLogLevel(),
	}))

	var pathPrefix string
	flag.StringVar(&pathPrefix, "prefix", "/", "path prefix for API and UI routes (must start with '/', use '/' for no prefix)")

	var healthCheckName string
	flag.StringVar(&healthCheckName, "healthcheck", "", "the name of the health checks: minimal or complete")

	var silentHealthChecks bool
	flag.BoolVar(&silentHealthChecks, "silent-healthchecks", false, "silence request logs for health check routes")

	flag.Parse()

	if healthCheckName != "" {
		if err := checkHealth(ctx, pathPrefix, healthCheckName); err != nil {
			logger.ErrorContext(ctx, "Error checking for server health", slog.String("error", err.Error()))
			os.Exit(1)
		}
		os.Exit(0)
	}

	initRes, err := initServer(ctx, &initServerOpts{
		logger:             logger,
		pathPrefix:         pathPrefix,
		silentHealthChecks: silentHealthChecks,
	}, createClient, createBundle)
	if err != nil {
		logger.ErrorContext(ctx, "Error initializing server", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := startAndListen(ctx, logger, initRes); err != nil {
		logger.ErrorContext(ctx, "Error starting server", slog.String("error", err.Error()))
		os.Exit(1)
	}
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
	dbPool     *pgxpool.Pool    // database pool; close must be deferred by caller!
	httpServer *http.Server     // HTTP server wrapping the UI handler
	logger     *slog.Logger     // application logger (also internalized in UI handler)
	uiHandler  *riverui.Handler // River UI handler
}

type initServerOpts struct {
	logger             *slog.Logger
	pathPrefix         string
	silentHealthChecks bool
}

func initServer[TClient any](ctx context.Context, opts *initServerOpts, createClient func(dbPool *pgxpool.Pool, schema string) (TClient, error), createBundle func(TClient) uiendpoints.Bundle) (*initServerResult, error) {
	if opts == nil {
		return nil, errors.New("opts is required")
	}
	if opts.pathPrefix == "" {
		return nil, errors.New("invalid path prefix: cannot be empty (use \"/\" for no prefix)")
	}
	if !strings.HasPrefix(opts.pathPrefix, "/") {
		return nil, fmt.Errorf("invalid path prefix %q: must start with '/' (use \"/\" for no prefix)", opts.pathPrefix)
	}

	opts.pathPrefix = riverui.NormalizePathPrefix(opts.pathPrefix)

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

	schema := os.Getenv("RIVER_SCHEMA")
	if schema == "" {
		schema = poolConfig.ConnConfig.Config.RuntimeParams["search_path"]
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("error connecting to db: %w", err)
	}

	client, err := createClient(dbPool, schema)
	if err != nil {
		return nil, err
	}

	uiHandler, err := riverui.NewHandler(&riverui.HandlerOpts{
		DevMode:                  devMode,
		Endpoints:                createBundle(client),
		JobListHideArgsByDefault: jobListHideArgsByDefault,
		LiveFS:                   liveFS,
		Logger:                   opts.logger,
		Prefix:                   opts.pathPrefix,
	})
	if err != nil {
		return nil, err
	}

	corsHandler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: corsOrigins,
	})
	filters := []sloghttp.Filter{}
	if opts.silentHealthChecks {
		apiHealthPrefix := opts.pathPrefix + "/api/health-checks"
		filters = append(filters, sloghttp.IgnorePathPrefix(apiHealthPrefix))
	}
	logHandler := sloghttp.NewWithConfig(opts.logger, sloghttp.Config{
		Filters:     filters,
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
			Handler:           middlewareStack.Mount(uiHandler),
			ReadHeaderTimeout: 5 * time.Second,
		},
		logger:    opts.logger,
		uiHandler: uiHandler,
	}, nil
}

func startAndListen(ctx context.Context, logger *slog.Logger, initRes *initServerResult) error {
	defer initRes.dbPool.Close()

	if err := initRes.uiHandler.Start(ctx); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Starting server", slog.String("addr", initRes.httpServer.Addr))

	err := initRes.httpServer.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}
