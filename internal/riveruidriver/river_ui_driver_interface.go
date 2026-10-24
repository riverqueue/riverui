// Package riveruidriver defines the database operations that River UI adds on top of
// River's core driver. Database-specific implementations keep SQL dialect
// details out of HTTP endpoints while continuing to use the executor already
// owned by the caller's River client.
package riveruidriver

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
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
	// JobDeadLetterList returns at most Max jobs, ordered by ID descending so
	// the newest dead letter jobs come first and stay reachable when more jobs
	// match than Max. Only Pro endpoints call this query; it requires the dead
	// letter table.
	JobDeadLetterList(ctx context.Context, params *JobDeadLetterListParams) ([]*JobDeadLetterListResult, error)
	// JobDeadLetterAutocomplete returns at most Max distinct values of the
	// facet that start with Match and aren't in Exclude. Every driver compares
	// and orders values the same way regardless of database collation: Match
	// ignores the case of ASCII letters only, and values sort by their UTF-8
	// bytes. Only Pro endpoints call this query; it requires the dead letter
	// table.
	JobDeadLetterAutocomplete(ctx context.Context, params *JobDeadLetterAutocompleteParams) ([]string, error)
}

const (
	// JobDeadLetterListMaxDefault is the number of jobs to list when the caller
	// has no preference.
	JobDeadLetterListMaxDefault = 20
	// JobDeadLetterListMaxLimit is the largest Max that JobDeadLetterList
	// accepts.
	JobDeadLetterListMaxLimit = 200
	// JobDeadLetterAutocompleteMaxLimit is the largest Max that
	// JobDeadLetterAutocomplete accepts.
	JobDeadLetterAutocompleteMaxLimit = 100
)

// JobDeadLetterFacet is a job attribute that JobDeadLetterAutocomplete can
// suggest values for. The queries compare against these values literally.
type JobDeadLetterFacet string

const (
	JobDeadLetterFacetJobKind   JobDeadLetterFacet = "job_kind"
	JobDeadLetterFacetQueueName JobDeadLetterFacet = "queue_name"
)

// JobDeadLetterFilters matches any value within each populated filter and
// requires all populated filters to match. Tags match any exact tag.
type JobDeadLetterFilters struct {
	IDs        []int64  `json:"ids,omitempty"`
	Kinds      []string `json:"kinds,omitempty"`
	Priorities []int16  `json:"priorities,omitempty"`
	Queues     []string `json:"queues,omitempty"`
	Tags       []string `json:"tags,omitempty"`
}

type JobDeadLetterAutocompleteParams struct {
	Exclude []string
	Facet   JobDeadLetterFacet
	Match   string
	Max     int
	Schema  string
}

// Validate reports whether the params are ones that every driver accepts.
// Drivers call it before querying so they all reject the same inputs.
func (p *JobDeadLetterAutocompleteParams) Validate() error {
	switch p.Facet {
	case JobDeadLetterFacetJobKind, JobDeadLetterFacetQueueName:
	default:
		return errors.New("invalid dead letter autocomplete facet")
	}
	if p.Max < 1 || p.Max > JobDeadLetterAutocompleteMaxLimit {
		return fmt.Errorf("dead letter autocomplete max must be between 1 and %d", JobDeadLetterAutocompleteMaxLimit)
	}
	return nil
}

type JobDeadLetterListParams struct {
	Filters JobDeadLetterFilters
	Max     int
	Schema  string
}

// Validate reports whether the params are ones that every driver accepts.
// Drivers call it before querying so they all reject the same inputs.
func (p *JobDeadLetterListParams) Validate() error {
	if p.Max < 1 || p.Max > JobDeadLetterListMaxLimit {
		return fmt.Errorf("dead letter list max must be between 1 and %d", JobDeadLetterListMaxLimit)
	}
	return nil
}

// JobDeadLetterListResult contains only fields displayed in the list. Args,
// metadata, and attempt history are loaded separately when opening a job.
//
// FinalizedAt is in UTC. Its precision is the one difference between drivers:
// PostgreSQL returns microseconds while SQLite returns milliseconds.
type JobDeadLetterListResult struct {
	ID          int64      `json:"id"`
	Attempt     int        `json:"attempt"`
	FinalizedAt *time.Time `json:"finalized_at"`
	Kind        string     `json:"kind"`
	MaxAttempts int        `json:"max_attempts"`
	Queue       string     `json:"queue"`
}

// NormalizeJobDeadLetterListResults puts decoded jobs into the form that every
// driver returns. Jobs are ordered by ID descending, because not every database
// guarantees the order of elements within an aggregated JSON array. Timestamps
// are in UTC, because PostgreSQL renders them in the session's time zone while
// SQLite renders them in UTC.
func NormalizeJobDeadLetterListResults(jobs []*JobDeadLetterListResult) {
	for _, job := range jobs {
		if job.FinalizedAt != nil {
			*job.FinalizedAt = job.FinalizedAt.UTC()
		}
	}
	slices.SortFunc(jobs, func(a, b *JobDeadLetterListResult) int { return cmp.Compare(b.ID, a.ID) })
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
