package prohandler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

func TestJobSequenceGet(t *testing.T) {
	t.Parallel()

	t.Run("Halted", func(t *testing.T) {
		t.Parallel()
		ctx := t.Context()
		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		insert := func(id int64, state rivertype.JobState) {
			params := testfactory.Job_Build(t, &testfactory.JobOpts{Metadata: []byte(`{"seq_key":"invoice"}`), State: &state})
			params.Schema = bundle.schema
			if state == rivertype.JobStateCancelled {
				params.FinalizedAt = new(time.Now())
			}
			job, err := bundle.exec.JobInsertFull(ctx, params)
			require.NoError(t, err)
			require.NoError(t, bundle.exec.Exec(ctx, fmt.Sprintf("UPDATE %s.river_job SET id = %d WHERE id = %d", dbutil.SafeIdentifier(bundle.schema), id, job.ID)))
		}
		const blockerID int64 = 1970670598291982290
		insert(blockerID, rivertype.JobStateCancelled)
		insert(blockerID+1, rivertype.JobStatePending)
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: blockerID + 1})
		require.NoError(t, err)
		require.Equal(t, "halted", resp.WaitReason)
		require.Equal(t, "invoice", resp.Key)
		require.Equal(t, blockerID+1, resp.FirstPending.ID)
		require.Len(t, resp.Blockers, 1)
		require.Equal(t, blockerID, resp.Blockers[0].ID)
		encoded, err := json.Marshal(resp)
		require.NoError(t, err)
		require.Contains(t, string(encoded), `"id":"1970670598291982290"`)
		require.Contains(t, string(encoded), `"job_id":"1970670598291982291"`)
		require.NotContains(t, string(encoded), `"metadata"`)
	})

	t.Run("Missing", func(t *testing.T) {
		t.Parallel()
		endpoint, _ := setupEndpoint(t.Context(), t, NewJobSequenceGetEndpoint)
		_, err := apitest.InvokeHandler(t.Context(), endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: 9223372036854775807})
		require.ErrorContains(t, err, "not found")
	})

	t.Run("MissingIndex", func(t *testing.T) {
		t.Parallel()
		endpoint, bundle := setupEndpoint(t.Context(), t, NewJobSequenceGetEndpoint)
		require.NoError(t, bundle.exec.Exec(t.Context(), "DROP INDEX "+dbutil.SafeIdentifier(bundle.schema)+".river_job_sequence_scheduling"))
		_, err := apitest.InvokeHandler(t.Context(), endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: 1})
		require.ErrorContains(t, err, "sequence scheduling index")
	})

	t.Run("Validation", func(t *testing.T) {
		t.Parallel()
		for _, value := range []string{"not-a-number", "9223372036854775808"} {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
			req.SetPathValue("job_id", value)
			require.Error(t, new(jobSequenceGetRequest).ExtractRaw(req))
		}
		endpoint, _ := setupEndpoint(t.Context(), t, NewJobSequenceGetEndpoint)
		for _, id := range []int64{0, -1} {
			_, err := apitest.InvokeHandler(t.Context(), endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: id})
			require.Error(t, err)
		}
	})
}
