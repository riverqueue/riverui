package apibundle

import (
	"context"
	"log/slog"

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
	Extensions               func(ctx context.Context) (map[string]bool, error)
	JobListHideArgsByDefault bool
	Logger                   *slog.Logger
}

// APIExtensionsProviderSetter is an interface to allow setting the extensions
// provider for the feature flag API.
type APIExtensionsProviderSetter interface {
	SetExtensionsProvider(provider func(context.Context) (map[string]bool, error))
}
