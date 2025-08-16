package apibundle

import (
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
	Extensions               map[string]bool
	JobListHideArgsByDefault bool
	Logger                   *slog.Logger
}
