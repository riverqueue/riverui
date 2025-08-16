package uiendpoints

import (
	"log/slog"
	"net/http"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/river/rivershared/baseservice"
)

type BundleOpts struct {
	JobListHideArgsByDefault bool
}

// Bundle is a collection of API endpoints and features for a riverui.Handler.
// A Bundle must be provided to the Handler via the `Endpoints` option of
// `HandlerOpts`.
//
// Two constructors are provided:
//
//   - `riverui.NewEndpoints` returns the open source riverui bundle
//   - `riverproui.NewEndpoints` returns the Pro-specific bundle with Pro APIs and
//     features enabled. The `riverproui` package is a separate module that
//     requires the `riverpro` module to be installed.
type Bundle interface {
	Configure(bundleOpts *BundleOpts)
	MountEndpoints(archetype *baseservice.Archetype, logger *slog.Logger, mux *http.ServeMux, mountOpts *apiendpoint.MountOpts, extensions map[string]bool) []apiendpoint.EndpointInterface
	Validate() error
}
