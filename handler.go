package riverui

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/riverqueue/river"
	"github.com/riverqueue/riverui/internal/apiendpoint"
	"github.com/riverqueue/riverui/internal/apimiddleware"
	"github.com/riverqueue/riverui/internal/dbsqlc"
	"github.com/riverqueue/riverui/ui"
)

type DBTXWithBegin interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	dbsqlc.DBTX
}

// HandlerOpts are the options for creating a new Handler.
type HandlerOpts struct {
	// Client is the River client to use for API requests.
	Client *river.Client[pgx.Tx]
	// DBPool is the database connection pool to use for API requests.
	DBPool DBTXWithBegin
	// Logger is the logger to use logging errors within the handler.
	Logger *slog.Logger
	// Prefix is the path prefix to use for the API and UI HTTP requests.
	Prefix string
}

func (opts *HandlerOpts) validate() error {
	if opts.Client == nil {
		return errors.New("client is required")
	}
	if opts.DBPool == nil {
		return errors.New("db pool is required")
	}
	if opts.Logger == nil {
		return errors.New("logger is required")
	}
	opts.Prefix = normalizePathPrefix(opts.Prefix)
	return nil
}

func normalizePathPrefix(prefix string) string {
	if prefix == "" {
		return "/"
	}
	prefix = strings.TrimSuffix(prefix, "/")
	if !strings.HasPrefix(prefix, "/") {
		return "/" + prefix
	}
	return prefix
}

// NewHandler creates a new http.Handler that serves the River UI and API.
func NewHandler(opts *HandlerOpts) (http.Handler, error) {
	if opts == nil {
		return nil, errors.New("opts is required")
	}
	if err := opts.validate(); err != nil {
		return nil, err
	}

	frontendIndex, err := fs.Sub(ui.Index, "dist")
	if err != nil {
		return nil, fmt.Errorf("error getting frontend index: %w", err)
	}
	httpFS := http.FS(frontendIndex)
	fileServer := http.FileServer(httpFS)
	serveIndex := serveFileContents("index.html", httpFS)

	apiBundle := apiBundle{
		client: opts.Client,
		dbPool: opts.DBPool,
		logger: opts.Logger,
	}

	prefix := opts.Prefix

	mux := http.NewServeMux()
	apiendpoint.Mount(mux, opts.Logger, &healthCheckGetEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &jobCancelEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &jobDeleteEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &jobListEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &jobRetryEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &jobGetEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &queueGetEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &queueListEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &queuePauseEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &queueResumeEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &stateAndCountGetEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &workflowGetEndpoint{apiBundle: apiBundle})
	apiendpoint.Mount(mux, opts.Logger, &workflowListEndpoint{apiBundle: apiBundle})

	if err := mountStaticFiles(opts.Logger, mux); err != nil {
		return nil, err
	}

	mux.HandleFunc("/api", http.NotFound)
	mux.Handle("/", intercept404(fileServer, serveIndex))

	middlewareStack := apimiddleware.NewMiddlewareStack()

	if prefix != "/" {
		middlewareStack.Use(&stripPrefixMiddleware{prefix})
	}

	return middlewareStack.Mount(mux), nil
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
	if m.prefix == "" {
		return handler
	}
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
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
