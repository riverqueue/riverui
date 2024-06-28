package riverui

import (
	"context"
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
	"github.com/riverqueue/riverui/internal/db"
	"github.com/riverqueue/riverui/ui"
)

type DBTXWithBegin interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	db.DBTX
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
		client:  opts.Client,
		dbPool:  opts.DBPool,
		logger:  opts.Logger,
		queries: db.New(opts.DBPool),
	}

	handler := &apiHandler{apiBundle: apiBundle}
	prefix := opts.Prefix

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/jobs", handler.JobList)
	apiendpoint.Mount(mux, opts.Logger, &jobCancelEndpoint{apiBundle: apiBundle})
	mux.HandleFunc("POST /api/jobs/delete", handler.JobDelete)
	mux.HandleFunc("POST /api/jobs/retry", handler.JobRetry)
	apiendpoint.Mount(mux, opts.Logger, &jobGetEndpoint{apiBundle: apiBundle})
	mux.HandleFunc("GET /api/queues", handler.QueueList)
	mux.HandleFunc("GET /api/queues/{name}", handler.QueueGet)
	mux.HandleFunc("PUT /api/queues/{name}/pause", handler.QueuePause)
	mux.HandleFunc("PUT /api/queues/{name}/resume", handler.QueueResume)
	mux.HandleFunc("GET /api/workflows/{id}", handler.WorkflowGet)
	mux.HandleFunc("GET /api/states", handler.StatesAndCounts)
	mux.HandleFunc("/api", http.NotFound)
	mux.Handle("/", intercept404(fileServer, serveIndex))

	if prefix != "/" {
		return stripPrefix(prefix, mux), nil
	}
	return mux, nil
}

// Go's http.StripPrefix can sometimes result in an empty path. For example,
// when removing a prefix like "/foo" from path "/foo", the result is "".  This
// does not get handled by the ServeMux correctly (it results in a redirect to
// "/"). To avoid this, fork the StripPrefix implementation and ensure we never
// return an empty path.
func stripPrefix(prefix string, handler http.Handler) http.Handler {
	if prefix == "" {
		return handler
	}
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		path := strings.TrimPrefix(request.URL.Path, prefix)
		if path == "" {
			path = "/"
		}
		rawPath := strings.TrimPrefix(request.URL.RawPath, prefix)
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
			redirectResponseWriter := &redirectPrefixResponseWriter{ResponseWriter: responseWriter, prefix: prefix}
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
