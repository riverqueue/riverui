package apibundle

import (
	"log/slog"
	"net/http"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/baseservice"
)

// APIBundle is a bundle of common types needed for many API endpoints.
type APIBundle[TTx any] struct {
	Archetype                *baseservice.Archetype
	Client                   *river.Client[TTx]
	DB                       riverdriver.Executor
	Driver                   riverdriver.Driver[TTx]
	Extensions               map[string]bool
	JobListHideArgsByDefault bool
	Logger                   *slog.Logger
}

type EndpointBundleOpts struct {
	JobListHideArgsByDefault bool
}

type EndpointBundle interface {
	Configure(bundleOpts *EndpointBundleOpts)
	MountEndpoints(archetype *baseservice.Archetype, logger *slog.Logger, mux *http.ServeMux, mountOpts *apiendpoint.MountOpts, extensions map[string]bool) []apiendpoint.EndpointInterface
	Validate() error
}
