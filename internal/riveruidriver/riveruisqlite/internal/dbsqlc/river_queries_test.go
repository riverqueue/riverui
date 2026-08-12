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
