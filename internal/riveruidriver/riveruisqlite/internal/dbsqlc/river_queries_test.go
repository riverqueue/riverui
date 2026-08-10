package dbsqlc

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivertype"
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
