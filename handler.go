package riverui

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivershared/baseservice"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/util/randutil"
	"github.com/riverqueue/river/rivershared/util/valutil"

	"riverqueue.com/riverui/internal/apiendpoint"
	"riverqueue.com/riverui/internal/apimiddleware"
)

// DB is the interface for a pgx database connection.
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Exec(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, query string, args ...interface{}) pgx.Row
}

// ServerOpts are the options for creating a new Server.
type ServerOpts struct {
	// Client is the River client to use for API requests.
	Client *river.Client[pgx.Tx]
	// DB is the database to use for API requests.
	DB DB
	// DevMode is whether the server is running in development mode.
	DevMode bool
	// LiveFS is whether to use the live filesystem for the frontend.
	LiveFS bool
	// Logger is the logger to use logging errors within the handler.
	Logger *slog.Logger
	// Prefix is the path prefix to use for the API and UI HTTP requests.
	Prefix string
}

func (opts *ServerOpts) validate() error {
	if opts.Client == nil {
		return errors.New("client is required")
	}
	if opts.DB == nil {
		return errors.New("db is required")
	}
	if opts.Logger == nil {
		return errors.New("logger is required")
	}
	opts.Prefix = NormalizePathPrefix(opts.Prefix)
	return nil
}

func NormalizePathPrefix(prefix string) string {
	if prefix == "" {
		return "/"
	}
	prefix = strings.TrimSuffix(prefix, "/")
	if !strings.HasPrefix(prefix, "/") {
		return "/" + prefix
	}
	return prefix
}

// Server is an HTTP server that serves the River UI and API.  It must be
// started with Start to initialize caching and background query functionality
// prior to serving requests. Server implements http.Handler, so it can be
// directly mounted in an http.ServeMux.
type Server struct {
	baseStartStop startstop.BaseStartStop
	handler       http.Handler
	services      []startstop.Service
}

// NewServer creates a new Server that serves the River UI and API.
func NewServer(opts *ServerOpts) (*Server, error) {
	if opts == nil {
		return nil, errors.New("opts is required")
	}
	if err := opts.validate(); err != nil {
		return nil, err
	}

	prefix := valutil.ValOrDefault(strings.TrimSuffix(opts.Prefix, "/"), "")

	frontendIndex, err := fs.Sub(FrontendIndex, "dist")
	if err != nil {
		return nil, fmt.Errorf("error getting frontend index: %w", err)
	}

	if opts.LiveFS {
		if opts.DevMode {
			fmt.Println("Using live filesystem at ./public")
			frontendIndex = os.DirFS("./public")
		} else {
			fmt.Println("Using live filesystem at ./dist")
			frontendIndex = os.DirFS("./dist")
		}
	}

	if !opts.DevMode {
		if _, err := frontendIndex.Open(".vite/manifest.json"); err != nil {
			return nil, errors.New("manifest.json not found")
		}
		if _, err := frontendIndex.Open("index.html"); err != nil {
			return nil, errors.New("index.html not found")
		}
	}
	manifest, err := readManifest(frontendIndex, opts.DevMode)
	if err != nil {
		return nil, err
	}

	httpFS := http.FS(frontendIndex)
	fileServer := http.FileServer(httpFS)
	serveIndex := serveIndexHTML(opts.DevMode, manifest, prefix, httpFS)

	apiBundle := apiBundle{
		// TODO: Switch to baseservice.NewArchetype when available.
		archetype: &baseservice.Archetype{
			Logger: opts.Logger,
			Rand:   randutil.NewCryptoSeededConcurrentSafeRand(),
			Time:   &baseservice.UnStubbableTimeGenerator{},
		},
		client: opts.Client,
		dbPool: opts.DB,
		logger: opts.Logger,
	}

	mux := http.NewServeMux()

	endpoints := []apiendpoint.EndpointInterface{
		apiendpoint.Mount(mux, opts.Logger, newHealthCheckGetEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newJobCancelEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newJobDeleteEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newJobListEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newJobRetryEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newJobGetEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newQueueGetEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newQueueListEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newQueuePauseEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newQueueResumeEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newStateAndCountGetEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newWorkflowGetEndpoint(apiBundle)),
		apiendpoint.Mount(mux, opts.Logger, newWorkflowListEndpoint(apiBundle)),
	}

	var services []startstop.Service

	type WithSubServices interface {
		SubServices() []startstop.Service
	}

	// If any endpoints are start/stop services, start them up.
	for _, endpoint := range endpoints {
		if withSubServices, ok := endpoint.(WithSubServices); ok {
			services = append(services, withSubServices.SubServices()...)
		}
	}

	if err := mountStaticFiles(opts.Logger, mux); err != nil {
		return nil, err
	}

	mux.HandleFunc("/api", http.NotFound)
	mux.Handle("/", intercept404(fileServer, serveIndex))

	middlewareStack := apimiddleware.NewMiddlewareStack()

	if prefix != "/" {
		middlewareStack.Use(&stripPrefixMiddleware{prefix})
	}

	server := &Server{
		handler:  middlewareStack.Mount(mux),
		services: services,
	}

	return server, nil
}

// ServeHTTP returns an http.ServeHTTP that can be mounted to serve HTTP
// requests.
func (s *Server) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	s.handler.ServeHTTP(rw, req)
}

// Start starts the server's background services. Notably, this does _not_ cause
// the server to start listening for HTTP in any way. To serve HTTP requests,
// the Server implements `http.Handler` via a `ServeHTTP` method and can be
// mounted in an existing `http.ServeMux`.
func (s *Server) Start(ctx context.Context) error {
	ctx, shouldStart, started, stopped := s.baseStartStop.StartInit(ctx)
	if !shouldStart {
		return nil
	}

	// TODO: Replace with startstop.StartAll when possible.
	for _, service := range s.services {
		if err := service.Start(ctx); err != nil {
			return err
		}
	}

	go func() {
		// Wait for all subservices to start up before signaling our own start.
		startstop.WaitAllStarted(s.services...)

		started()
		defer stopped() // this defer should come first so it's last out

		<-ctx.Done()

		startstop.StopAllParallel(s.services...)
	}()

	return nil
}

func readManifest(frontendIndex fs.FS, devMode bool) (map[string]interface{}, error) {
	if devMode {
		return map[string]interface{}{}, nil
	}

	file, err := frontendIndex.Open(".vite/manifest.json")
	if err != nil {
		return nil, err
	}
	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, errors.New("could not read .vite/manifest.json")
	}
	var manifest map[string]interface{}
	err = json.Unmarshal(bytes, &manifest)
	if err != nil {
		return nil, errors.New("could not unmarshal .vite/manifest.json")
	}
	return manifest, nil
}

//go:embed public
var publicFS embed.FS

const publicPrefix = "public/"

// Walks the embedded filesystem in publicFS and mounts each file as a route on
// the given serve mux. Content type is determined by `http.DetectContentType`.
func mountStaticFiles(logger *slog.Logger, mux *http.ServeMux) error {
	return fs.WalkDir(publicFS, ".", func(path string, dirEntry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if dirEntry.IsDir() {
			return nil
		}

		servePath := strings.TrimPrefix(path, publicPrefix)

		mux.HandleFunc("GET /"+servePath, func(w http.ResponseWriter, r *http.Request) {
			runWithError := func() error {
				data, err := publicFS.ReadFile(path)
				if err != nil {
					return err
				}

				contentType := http.DetectContentType(data)
				w.Header().Add("Content-Type", contentType)

				if _, err := w.Write(data); err != nil {
					return err
				}

				return nil
			}

			if err := runWithError(); err != nil {
				logger.ErrorContext(r.Context(), "Error writing static file", "err", err)
			}
		})

		return nil
	})
}

// Go's http.StripPrefix can sometimes result in an empty path. For example,
// when removing a prefix like "/foo" from path "/foo", the result is "".  This
// does not get handled by the ServeMux correctly (it results in a redirect to
// "/"). To avoid this, fork the StripPrefix implementation and ensure we never
// return an empty path.
type stripPrefixMiddleware struct {
	prefix string
}

func (m *stripPrefixMiddleware) Middleware(handler http.Handler) http.Handler {
	if m.prefix == "" || m.prefix == "/" {
		return handler
	}
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		if !strings.HasSuffix(m.prefix, "/") && request.URL.Path == m.prefix {
			http.Redirect(responseWriter, request, m.prefix+"/", http.StatusMovedPermanently)
			return
		}

		path := strings.TrimPrefix(request.URL.Path, m.prefix)
		if path == "" {
			path = "/"
		}
		rawPath := strings.TrimPrefix(request.URL.RawPath, m.prefix)
		if rawPath == "" {
			rawPath = "/"
		}
		if len(path) < len(request.URL.Path) && (request.URL.RawPath == "" || len(rawPath) < len(request.URL.RawPath)) {
			request2 := new(http.Request)
			*request2 = *request
			request2.URL = new(url.URL)
			*request2.URL = *request.URL
			request2.URL.Path = path
			request2.URL.RawPath = rawPath
			redirectResponseWriter := &redirectPrefixResponseWriter{ResponseWriter: responseWriter, prefix: m.prefix}
			handler.ServeHTTP(redirectResponseWriter, request2)
		} else {
			http.NotFound(responseWriter, request)
		}
	})
}

// redirectPrefixResponseWriter is required to correct the http.ServeMux behavior
// with redirects that have no way of accounting for a path prefix. It intercepts
// the exact usage of http.Redirect and corrects the Location header to include
// the prefix, and rewrites the HTML response to include the prefixed link.
//
// There are no other redirects issued by this ServeMux so this is safe.
type redirectPrefixResponseWriter struct {
	http.ResponseWriter
	code   int
	prefix string
}

// Write corrects the HTML response for http.Redirect 301 redirect to include a
// prefixed link.
func (rw *redirectPrefixResponseWriter) Write(b []byte) (int, error) {
	if rw.code != http.StatusMovedPermanently {
		return rw.ResponseWriter.Write(b)
	}

	location := rw.Header().Get("Location")

	body := "<a href=\"" + htmlEscape(location) + "\">" + http.StatusText(http.StatusMovedPermanently) + "</a>.\n"
	return fmt.Fprintln(rw.ResponseWriter, body)
}

// WriteHeader corrects the Location header for http.Redirect 301 redirect to
// include a prefixed URL.
func (rw *redirectPrefixResponseWriter) WriteHeader(code int) {
	rw.code = code
	if code >= 300 && code < 400 {
		if location := rw.Header().Get("Location"); location != "" {
			rw.Header().Set("Location", rw.prefix+location)
		}
	}
	rw.ResponseWriter.WriteHeader(code)
}

var htmlReplacer = strings.NewReplacer( //nolint:gochecknoglobals
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	// "&#34;" is shorter than "&quot;".
	`"`, "&#34;",
	// "&#39;" is shorter than "&apos;" and apos was not in HTML until HTML5.
	"'", "&#39;",
)

func htmlEscape(s string) string {
	return htmlReplacer.Replace(s)
}
