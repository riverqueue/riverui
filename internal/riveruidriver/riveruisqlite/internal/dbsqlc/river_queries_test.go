package dbsqlc

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
)

func TestJobCountByAllStatesCappedQueryStates(t *testing.T) {
	t.Parallel()

	for _, state := range rivertype.JobStates() {
		require.Contains(t, jobCountByAllStatesCapped, "state = '"+string(state)+"'")
	}
}

func TestJobCountEstimateStat4Query(t *testing.T) {
	t.Parallel()

	require.Contains(t, jobCountEstimateStat4, "sqlite_stat4")
	require.Contains(t, jobCountEstimateStat4, "river_job_prioritized_fetching_index")
	require.Contains(t, jobCountEstimateStat4, "group_concat")
}

func TestJobDeadLetterAutocompleteQueryFacets(t *testing.T) {
	t.Parallel()

	// The query selects kinds for the job kind facet and queues for anything
	// else, so its literal must stay in step with the driver's facet values.
	require.Contains(t, jobDeadLetterAutocomplete, "= '"+string(riveruidriver.JobDeadLetterFacetJobKind)+"' THEN kind ELSE queue END")
	require.NotContains(t, jobDeadLetterAutocomplete, string(riveruidriver.JobDeadLetterFacetQueueName))
}
