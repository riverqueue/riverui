package riveruidrivertest

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/testfactory"
	"github.com/riverqueue/river/rivershared/util/dbutil"

	"riverqueue.com/riverui/internal/riveruidriver"
)

// createJobDeadLetterTable creates the dead letter table in the test schema and
// returns the prefix that qualifies table names in it. OSS test schemas don't
// include Pro tables, so reproduce only the columns these queries need,
// preserving each database's timestamp column type.
func createJobDeadLetterTable(ctx context.Context, t *testing.T, executor riveruidriver.Executor, schema string) string {
	t.Helper()

	prefix := ""
	if schema != "" {
		prefix = dbutil.SafeIdentifier(schema) + "."
	}
	require.NoError(t, executor.Exec(ctx, "CREATE TABLE "+prefix+"river_job_dead_letter AS SELECT id, attempt, finalized_at, kind, max_attempts, queue, priority, tags FROM "+prefix+"river_job WHERE 1 = 0"))
	return prefix
}

func exerciseJobDeadLetterList(
	ctx context.Context,
	t *testing.T,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()
	const (
		urgentTag    = "urgent"
		reportKind   = "archive_report"
		mailQueue    = "mail"
		reportsQueue = "reports"
		originalKind = "send_email"
		customerTag  = "customer"
		emailKind    = "archive_email"
		kindFacet    = riveruidriver.JobDeadLetterFacetJobKind
	)
	t.Run("JobDeadLetterList", func(t *testing.T) {
		t.Parallel()
		executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
		prefix := createJobDeadLetterTable(ctx, t, executor, schema)
		testfactory.Job(ctx, t, executor, &testfactory.JobOpts{Schema: schema})
		jobs, err := executor.JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{Max: 20, Schema: schema})
		require.NoError(t, err)
		require.Empty(t, jobs, "live jobs must not appear in the dead letter list")
		require.NotNil(t, jobs)

		// Deliberately insert out of result order, with IDs beyond JavaScript's
		// exact integer range, and enough rows to exceed the maximum UI limit.
		const firstID int64 = 1970670598291982290
		rows := make([]string, 0, 205)
		for i := range 205 {
			finalizedAt := "'2026-10-21 10:02:03.456+00:00'"
			if i == 204 {
				finalizedAt = "NULL"
			}
			rows = append(rows, fmt.Sprintf("(%d, 3, %s, 'send_email', 5, 'mail')", firstID+int64(i), finalizedAt))
		}
		require.NoError(t, executor.Exec(ctx, "INSERT INTO "+prefix+"river_job_dead_letter (id, attempt, finalized_at, kind, max_attempts, queue) VALUES "+strings.Join(rows, ",")))

		for _, limit := range []int{1, riveruidriver.JobDeadLetterListMaxDefault, 40, riveruidriver.JobDeadLetterListMaxLimit} {
			jobs, err := executor.JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{Max: limit, Schema: schema})
			require.NoError(t, err)
			require.Len(t, jobs, limit)
			for i, job := range jobs {
				require.Equal(t, firstID+204-int64(i), job.ID, "newest jobs must come first")
				require.Equal(t, 3, job.Attempt)
				require.Equal(t, 5, job.MaxAttempts)
				require.Equal(t, originalKind, job.Kind)
				require.Equal(t, mailQueue, job.Queue)
				if i == 0 {
					require.Nil(t, job.FinalizedAt)
				} else {
					require.NotNil(t, job.FinalizedAt)
					require.True(t, job.FinalizedAt.Equal(time.Date(2026, time.October, 21, 10, 2, 3, 456_000_000, time.UTC)))
					require.Equal(t, time.UTC, job.FinalizedAt.Location(), "timestamps must be in UTC on every driver")
				}
			}
		}
		for _, limit := range []int{-1, 0, riveruidriver.JobDeadLetterListMaxLimit + 1} {
			_, err := executor.JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{Max: limit, Schema: schema})
			require.EqualError(t, err, "dead letter list max must be between 1 and 200")
		}

		// Filtering must happen before limiting, without rounding large IDs.
		jobs, err = executor.JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{
			Filters: riveruidriver.JobDeadLetterFilters{IDs: []int64{firstID}}, Max: 1, Schema: schema,
		})
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		require.Equal(t, firstID, jobs[0].ID)

		archive := func(kind, queue string, priority int, tags []string) int64 {
			job := testfactory.Job(ctx, t, executor, &testfactory.JobOpts{
				Kind: &kind, Queue: &queue, Priority: &priority, Tags: tags, Schema: schema,
			})
			require.NoError(t, executor.Exec(ctx, fmt.Sprintf("INSERT INTO %sriver_job_dead_letter SELECT id, attempt, finalized_at, kind, max_attempts, queue, priority, tags FROM %sriver_job WHERE id = %d", prefix, prefix, job.ID)))
			return job.ID
		}
		first := archive(emailKind, mailQueue, 1, []string{urgentTag, customerTag})
		second := archive(reportKind, reportsQueue, 3, []string{"batch", customerTag})
		third := archive(reportKind, mailQueue, 2, []string{"not-urgent"})
		for _, tt := range []struct {
			name    string
			filters riveruidriver.JobDeadLetterFilters
			want    []int64
		}{
			{name: "IDs", filters: riveruidriver.JobDeadLetterFilters{IDs: []int64{first, second}}, want: []int64{second, first}},
			{name: "IDsWithOtherFilters", filters: riveruidriver.JobDeadLetterFilters{IDs: []int64{first, second, third}, Queues: []string{mailQueue}}, want: []int64{third, first}},
			{name: "IDsNoMatches", filters: riveruidriver.JobDeadLetterFilters{IDs: []int64{firstID - 1}}, want: []int64{}},
			{name: "Kinds", filters: riveruidriver.JobDeadLetterFilters{Kinds: []string{emailKind, reportKind}}, want: []int64{third, second, first}},
			{name: "Queues", filters: riveruidriver.JobDeadLetterFilters{Queues: []string{reportsQueue}}, want: []int64{second}},
			{name: "Priorities", filters: riveruidriver.JobDeadLetterFilters{Priorities: []int16{1, 3}}, want: []int64{second, first}},
			{name: "TagsMatchAny", filters: riveruidriver.JobDeadLetterFilters{Tags: []string{urgentTag, "batch"}}, want: []int64{second, first}},
			{name: "TagsAreExact", filters: riveruidriver.JobDeadLetterFilters{Tags: []string{urgentTag}}, want: []int64{first}},
			{name: "Combined", filters: riveruidriver.JobDeadLetterFilters{Kinds: []string{emailKind, reportKind}, Queues: []string{mailQueue}, Priorities: []int16{1, 2}, Tags: []string{customerTag}}, want: []int64{first}},
			{name: "NoMatches", filters: riveruidriver.JobDeadLetterFilters{Kinds: []string{"missing"}}, want: []int64{}},
			{name: "LiteralValues", filters: riveruidriver.JobDeadLetterFilters{Tags: []string{"urgent' OR 1=1 --"}}, want: []int64{}},
			{name: "EmptyFilters", filters: riveruidriver.JobDeadLetterFilters{IDs: []int64{}, Kinds: []string{}, Queues: []string{}, Tags: []string{}, Priorities: []int16{}}, want: []int64{firstID + 204, firstID + 203, firstID + 202}},
		} {
			t.Run(tt.name, func(t *testing.T) {
				jobs, err := executor.JobDeadLetterList(ctx, &riveruidriver.JobDeadLetterListParams{Filters: tt.filters, Max: 3, Schema: schema})
				require.NoError(t, err)
				got := make([]int64, 0, len(jobs))
				for _, job := range jobs {
					got = append(got, job.ID)
				}
				require.Equal(t, tt.want, got)
			})
		}

		for _, tt := range []struct {
			name    string
			facet   riveruidriver.JobDeadLetterFacet
			match   string
			exclude []string
			max     int
			want    []string
		}{
			{name: "Kinds", facet: kindFacet, max: 100, want: []string{emailKind, reportKind, originalKind}},
			{name: "PrefixCaseInsensitive", facet: kindFacet, match: "ARCHIVE_", max: 100, want: []string{emailKind, reportKind}},
			{name: "Exclude", facet: kindFacet, match: "archive_", exclude: []string{reportKind}, max: 100, want: []string{emailKind}},
			{name: "Limit", facet: kindFacet, max: 1, want: []string{emailKind}},
			{name: "Queues", facet: riveruidriver.JobDeadLetterFacetQueueName, max: 100, want: []string{mailQueue, reportsQueue}},
			{name: "NoLiveJobs", facet: kindFacet, match: "fake_job", max: 100, want: []string{}},
			{name: "LiteralPrefix", facet: kindFacet, match: "%", max: 100, want: []string{}},
		} {
			t.Run("Autocomplete"+tt.name, func(t *testing.T) {
				values, err := executor.JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{Facet: tt.facet, Match: tt.match, Exclude: tt.exclude, Max: tt.max, Schema: schema})
				require.NoError(t, err)
				require.Equal(t, tt.want, values)
			})
		}
	})
}

// exerciseJobDeadLetterAutocomplete proves that every driver matches and orders
// suggestions the same way for text where database collations disagree:
// mixed-case ASCII and non-ASCII letters.
func exerciseJobDeadLetterAutocomplete(
	ctx context.Context,
	t *testing.T,
	databaseName string,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()
	const (
		kindFacet  = riveruidriver.JobDeadLetterFacetJobKind
		queueFacet = riveruidriver.JobDeadLetterFacetQueueName
	)
	t.Run("JobDeadLetterAutocomplete", func(t *testing.T) {
		t.Parallel()
		executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
		prefix := createJobDeadLetterTable(ctx, t, executor, schema)

		if databaseName == riverdriver.DatabaseNamePostgres {
			// Give the columns a linguistic collation where one is available so
			// the query is shown not to depend on the collation of the database
			// or its columns. Unlike "C", this collation folds non-ASCII letters
			// in lower() and sorts letters of both cases together.
			var hasICU bool
			require.NoError(t, executor.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu')").Scan(&hasICU))
			if hasICU {
				require.NoError(t, executor.Exec(ctx, "ALTER TABLE "+prefix+`river_job_dead_letter ALTER COLUMN kind TYPE text COLLATE "und-x-icu", ALTER COLUMN queue TYPE text COLLATE "und-x-icu"`))
			}
		}

		// Listed in the byte order that every driver must return. A linguistic
		// collation would instead return alpha, école, École, zebra, Zeta.
		const (
			zeta       = "Zeta"
			alpha      = "alpha"
			zebra      = "zebra"
			ecoleUpper = "École"
			ecoleLower = "école"
		)
		kinds := []string{zeta, alpha, zebra, ecoleUpper, ecoleLower}
		rows := make([]string, 0, len(kinds))
		for i, kind := range slices.Backward(kinds) {
			rows = append(rows, fmt.Sprintf("(%d, 3, NULL, '%s', 5, '%s')", i+1, kind, strings.ToUpper(kind)))
		}
		require.NoError(t, executor.Exec(ctx, "INSERT INTO "+prefix+"river_job_dead_letter (id, attempt, finalized_at, kind, max_attempts, queue) VALUES "+strings.Join(rows, ",")))

		for _, tt := range []struct {
			name    string
			facet   riveruidriver.JobDeadLetterFacet
			match   string
			exclude []string
			max     int
			want    []string
		}{
			{name: "ByteOrder", facet: kindFacet, max: 100, want: kinds},
			{name: "ByteOrderQueues", facet: queueFacet, max: 100, want: []string{"ALPHA", "ZEBRA", "ZETA", "ÉCOLE"}},
			{name: "LimitFollowsByteOrder", facet: kindFacet, max: 2, want: []string{zeta, alpha}},
			{name: "MixedCaseMatch", facet: kindFacet, match: "zE", max: 100, want: []string{zeta, zebra}},
			{name: "MixedCaseMatchUpper", facet: kindFacet, match: "ALPHA", max: 100, want: []string{alpha}},
			{name: "MixedCaseMatchQueues", facet: queueFacet, match: "zeb", max: 100, want: []string{"ZEBRA"}},
			{name: "NonASCIILower", facet: kindFacet, match: "é", max: 100, want: []string{ecoleLower}},
			{name: "NonASCIIUpper", facet: kindFacet, match: "É", max: 100, want: []string{ecoleUpper}},
			{name: "NonASCIIFoldsOnlyASCII", facet: kindFacet, match: "éCOLE", max: 100, want: []string{ecoleLower}},
			{name: "NonASCIIFoldsOnlyASCIIQueues", facet: queueFacet, match: "éc", max: 100, want: []string{}},
			{name: "NonASCIIExclude", facet: kindFacet, exclude: []string{ecoleUpper, "ZETA"}, max: 100, want: []string{zeta, alpha, zebra, ecoleLower}},
		} {
			t.Run(tt.name, func(t *testing.T) {
				values, err := executor.JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{Facet: tt.facet, Match: tt.match, Exclude: tt.exclude, Max: tt.max, Schema: schema})
				require.NoError(t, err)
				require.Equal(t, tt.want, values)
			})
		}

		// Drivers guard their own inputs rather than relying on the caller's
		// validation, and reject them before running a query.
		for _, facet := range []riveruidriver.JobDeadLetterFacet{"", "tags", "kind", "JOB_KIND"} {
			_, err := executor.JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{Facet: facet, Max: 100, Schema: schema})
			require.EqualError(t, err, "invalid dead letter autocomplete facet", "facet %q", facet)
		}
		for _, limit := range []int{-1, 0, riveruidriver.JobDeadLetterAutocompleteMaxLimit + 1} {
			_, err := executor.JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{Facet: kindFacet, Max: limit, Schema: schema})
			require.EqualError(t, err, "dead letter autocomplete max must be between 1 and 100", "max %d", limit)
		}
		for _, limit := range []int{1, riveruidriver.JobDeadLetterAutocompleteMaxLimit} {
			values, err := executor.JobDeadLetterAutocomplete(ctx, &riveruidriver.JobDeadLetterAutocompleteParams{Facet: kindFacet, Max: limit, Schema: schema})
			require.NoError(t, err)
			require.Len(t, values, min(limit, len(kinds)))
		}
	})
}
