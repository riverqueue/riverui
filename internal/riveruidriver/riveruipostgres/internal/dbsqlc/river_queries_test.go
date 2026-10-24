package dbsqlc

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
)

func TestJobCountEstimateQuery(t *testing.T) {
	t.Parallel()

	for _, state := range rivertype.JobStates() {
		query, err := jobCountEstimateQuery(state)
		require.NoError(t, err)
		require.Contains(t, query, "state = '"+string(state)+"'")
		require.NotContains(t, query, "$1", "state must remain a literal so PostgreSQL produces a state-specific plan")
	}

	_, err := jobCountEstimateQuery(rivertype.JobState("completed'; DROP TABLE river_job; --"))
	require.EqualError(t, err, `invalid job state for count estimate: "completed'; DROP TABLE river_job; --"`)
}

func TestJobCountByAllStatesCappedQueryStates(t *testing.T) {
	t.Parallel()

	for _, state := range rivertype.JobStates() {
		require.Contains(t, jobCountByAllStatesCapped, "state = '"+string(state)+"'")
	}
}

func TestJobDeadLetterAutocompleteQueryFacets(t *testing.T) {
	t.Parallel()

	// The query selects kinds for the job kind facet and queues for anything
	// else, so its literal must stay in step with the driver's facet values.
	require.Contains(t, jobDeadLetterAutocomplete, "= '"+string(riveruidriver.JobDeadLetterFacetJobKind)+"' THEN kind ELSE queue END")
	require.NotContains(t, jobDeadLetterAutocomplete, string(riveruidriver.JobDeadLetterFacetQueueName))
}
