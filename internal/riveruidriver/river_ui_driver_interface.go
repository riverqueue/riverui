// Package riveruidriver defines the database operations that River UI adds on top of
// River's core driver. Database-specific implementations keep SQL dialect
// details out of HTTP endpoints while continuing to use the executor already
// owned by the caller's River client.
package riveruidriver

import (
	"context"
	"time"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"
)

// Driver decorates a River executor with queries used only by River UI.
type Driver interface {
	GetExecutor(riverExecutor riverdriver.Executor) Executor
}

// Executor contains River UI's database operations and embeds River's executor
// so callers retain transaction and core query support through one value.
type Executor interface {
	riverdriver.Executor

	// JobCountByAllStatesCapped returns an exact count through Max and Max+1 as
	// a sentinel when additional rows exist.
	JobCountByAllStatesCapped(ctx context.Context, params *JobCountByAllStatesCappedParams) (map[rivertype.JobState]int, error)
	// JobCountEstimate returns inexpensive database estimates where supported.
	// Drivers without an estimate strategy return an empty map.
	JobCountEstimate(ctx context.Context, params *JobCountEstimateParams) (map[rivertype.JobState]JobCountEstimateResult, error)
}

type JobCountByAllStatesCappedParams struct {
	// Max must be positive and less than math.MaxInt32 so callers get the same
	// behavior from every database implementation.
	Max    int
	Schema string
}

type JobCountEstimateParams struct {
	Schema string
	States []rivertype.JobState
}

type JobCountEstimateResult struct {
	Count      int
	ObservedAt *time.Time
}
