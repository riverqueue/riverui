package prohandler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

// insertSequenceJobs inserts one job per state into a sequence, in order, and
// returns their IDs.
func insertSequenceJobs(ctx context.Context, t *testing.T, bundle *setupEndpointTestBundle, key string, states ...rivertype.JobState) []int64 {
	t.Helper()

	metadata, err := json.Marshal(map[string]string{"seq_key": key})
	require.NoError(t, err)

	ids := make([]int64, len(states))
	for i, state := range states {
		opts := &testfactory.JobOpts{Metadata: metadata, State: &state}
		switch state { //nolint:exhaustive
		case rivertype.JobStateCancelled, rivertype.JobStateCompleted, rivertype.JobStateDiscarded:
			opts.FinalizedAt = new(time.Now())
		}
		params := testfactory.Job_Build(t, opts)
		params.Schema = bundle.schema
		job, err := bundle.exec.JobInsertFull(ctx, params)
		require.NoError(t, err)
		ids[i] = job.ID
	}
	return ids
}

func TestJobSequenceGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Halted", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "order",
			rivertype.JobStateCompleted, rivertype.JobStateCancelled, rivertype.JobStatePending, rivertype.JobStatePending)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: ids[3]})
		require.NoError(t, err)
		require.False(t, resp.Halting)
		require.Equal(t, ids[3], resp.JobID)
		require.Equal(t, rivertype.JobStatePending, resp.JobState)
		require.Equal(t, "halted", string(resp.WaitReason))
		require.Equal(t, ids[1], resp.WaitingOn.ID)
		require.Equal(t, "order", resp.Sequence.Key)
		require.Equal(t, ids[1], resp.Sequence.HaltedBy.ID)
		require.Equal(t, ids[2], resp.Sequence.Head.ID)
		// Only a halting job's response counts the jobs it holds back.
		require.Nil(t, resp.Sequence.PendingCount)

		resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: ids[1]})
		require.NoError(t, err)
		require.True(t, resp.Halting)
		require.Equal(t, "none", string(resp.WaitReason))
		require.Nil(t, resp.WaitingOn)
		require.Equal(t, &sequencePendingCountResponse{Count: 2}, resp.Sequence.PendingCount)
	})

	t.Run("WaitingOnActive", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "order",
			rivertype.JobStateRunning, rivertype.JobStatePending, rivertype.JobStatePending)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: ids[1]})
		require.NoError(t, err)
		require.Equal(t, "waiting_on_active", string(resp.WaitReason))
		require.Equal(t, ids[0], resp.WaitingOn.ID)
		require.Equal(t, rivertype.JobStateRunning, resp.WaitingOn.State)

		resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: ids[2]})
		require.NoError(t, err)
		require.Equal(t, "waiting_behind_pending", string(resp.WaitReason))
		require.Equal(t, ids[1], resp.WaitingOn.ID)
	})

	t.Run("UpNext", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "order", rivertype.JobStateCompleted, rivertype.JobStatePending)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: ids[1]})
		require.NoError(t, err)
		require.Equal(t, "up_next", string(resp.WaitReason))
		require.Nil(t, resp.WaitingOn)
	})

	t.Run("LargeIDsEncodeAsStrings", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "order", rivertype.JobStateCancelled, rivertype.JobStatePending)
		// IDs past 2^53 lose precision as JSON numbers in the browser.
		const largeID int64 = 1970670598291982290
		for i, id := range ids {
			require.NoError(t, bundle.exec.Exec(ctx, "UPDATE "+dbutil.SafeIdentifier(bundle.schema)+".river_job SET id = $1 WHERE id = $2", largeID+int64(i), id))
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: largeID + 1})
		require.NoError(t, err)
		encoded, err := json.Marshal(resp)
		require.NoError(t, err)
		require.Contains(t, string(encoded), `"job_id":"1970670598291982291"`)
		require.Contains(t, string(encoded), `"id":"1970670598291982290"`)
	})

	t.Run("NotInSequence", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		params := testfactory.Job_Build(t, nil)
		params.Schema = bundle.schema
		job, err := bundle.exec.JobInsertFull(ctx, params)
		require.NoError(t, err)

		for _, id := range []int64{job.ID, 9223372036854775807} {
			_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: id})
			require.Equal(t, apierror.NewNotFoundf("Job %d isn't in a sequence.", id), err)
		}
	})

	t.Run("MissingIndex", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		require.NoError(t, bundle.exec.Exec(ctx, "DROP INDEX "+dbutil.SafeIdentifier(bundle.schema)+".river_job_sequence_scheduling"))

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: 1})
		require.ErrorContains(t, err, "Sequence queries require River Pro's sequence indexes")
	})

	t.Run("IndexCheckCached", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		req := &jobSequenceGetRequest{JobID: 9223372036854775807}
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), req)
		require.ErrorContains(t, err, "isn't in a sequence")

		// A polling page skips the catalog check after the indexes are seen.
		require.NoError(t, bundle.exec.Exec(ctx, "DROP INDEX "+dbutil.SafeIdentifier(bundle.schema)+".river_job_sequence_scheduling"))
		_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), req)
		require.ErrorContains(t, err, "isn't in a sequence")
	})

	t.Run("Validation", func(t *testing.T) {
		t.Parallel()

		for _, value := range []string{"not-a-number", "9223372036854775808"} {
			httpReq := httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil)
			httpReq.SetPathValue("job_id", value)
			require.Error(t, new(jobSequenceGetRequest).ExtractRaw(httpReq))
		}

		endpoint, _ := setupEndpoint(ctx, t, NewJobSequenceGetEndpoint)
		for _, id := range []int64{0, -1} {
			_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobSequenceGetRequest{JobID: id})
			require.Error(t, err)
		}
	})
}

func TestSequenceGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Halted", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewSequenceGetEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "a/b+c=",
			rivertype.JobStateCompleted, rivertype.JobStateDiscarded, rivertype.JobStatePending, rivertype.JobStatePending, rivertype.JobStatePending)
		_ = insertSequenceJobs(ctx, t, bundle, "other", rivertype.JobStatePending)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &sequenceGetRequest{Key: "a/b+c="})
		require.NoError(t, err)
		require.Equal(t, "a/b+c=", resp.Key)
		require.Equal(t, ids[1], resp.HaltedBy.ID)
		require.Equal(t, rivertype.JobStateDiscarded, resp.HaltedBy.State)
		require.Equal(t, ids[2], resp.Head.ID)
		require.Len(t, resp.Blockers, 1)
		require.Equal(t, &sequencePendingCountResponse{Count: 3}, resp.PendingCount)
	})

	t.Run("UnknownKey", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, NewSequenceGetEndpoint)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &sequenceGetRequest{Key: "missing"})
		require.NoError(t, err)
		require.Equal(t, &sequenceInspectionResponse{
			Blockers:     []*sequenceJobResponse{},
			Key:          "missing",
			PendingCount: &sequencePendingCountResponse{},
		}, resp)
	})

	t.Run("KeyRequired", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, NewSequenceGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &sequenceGetRequest{})
		require.Error(t, err)
	})
}

func TestSequenceJobListEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	listIDs := func(resp *sequenceJobListResponse) []int64 {
		ids := make([]int64, len(resp.Data))
		for i, job := range resp.Data {
			ids[i] = job.ID
		}
		return ids
	}

	t.Run("Paging", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewSequenceJobListEndpoint)
		ids := insertSequenceJobs(ctx, t, bundle, "order",
			rivertype.JobStateCompleted, rivertype.JobStateCompleted, rivertype.JobStateCancelled, rivertype.JobStatePending, rivertype.JobStatePending)
		_ = insertSequenceJobs(ctx, t, bundle, "other", rivertype.JobStatePending)

		invoke := func(req *sequenceJobListRequest) *sequenceJobListResponse {
			t.Helper()
			req.Key = "order"
			resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), req)
			require.NoError(t, err)
			return resp
		}

		// The default page holds the newest jobs.
		resp := invoke(&sequenceJobListRequest{Limit: 2})
		require.Equal(t, ids[3:], listIDs(resp))
		require.True(t, resp.HasEarlier)
		require.False(t, resp.HasLater)

		// Forward from before the halting job, with jobs on both sides.
		resp = invoke(&sequenceJobListRequest{AfterID: new(ids[1]), Limit: 2})
		require.Equal(t, ids[2:4], listIDs(resp))
		require.True(t, resp.HasEarlier)
		require.True(t, resp.HasLater)

		// An `after_id` of zero lists from the first job.
		resp = invoke(&sequenceJobListRequest{AfterID: new(int64(0)), Limit: 2})
		require.Equal(t, ids[:2], listIDs(resp))
		require.False(t, resp.HasEarlier)
		require.True(t, resp.HasLater)

		// Forward from the start.
		resp = invoke(&sequenceJobListRequest{AfterID: new(ids[0] - 1), Limit: 10})
		require.Equal(t, ids, listIDs(resp))
		require.False(t, resp.HasEarlier)
		require.False(t, resp.HasLater)

		// Backward toward the oldest job.
		resp = invoke(&sequenceJobListRequest{BeforeID: new(ids[2]), Limit: 1})
		require.Equal(t, ids[1:2], listIDs(resp))
		require.True(t, resp.HasEarlier)
		require.True(t, resp.HasLater)

		resp = invoke(&sequenceJobListRequest{BeforeID: new(ids[2]), Limit: 5})
		require.Equal(t, ids[:2], listIDs(resp))
		require.False(t, resp.HasEarlier)
		require.True(t, resp.HasLater)

		// Empty pages past either end still say what's on the other side.
		resp = invoke(&sequenceJobListRequest{AfterID: new(ids[4])})
		require.Empty(t, resp.Data)
		require.True(t, resp.HasEarlier)
		require.False(t, resp.HasLater)

		resp = invoke(&sequenceJobListRequest{BeforeID: new(ids[0])})
		require.Empty(t, resp.Data)
		require.False(t, resp.HasEarlier)
		require.True(t, resp.HasLater)
	})

	t.Run("Fields", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, NewSequenceJobListEndpoint)
		_ = insertSequenceJobs(ctx, t, bundle, "order", rivertype.JobStateCompleted)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &sequenceJobListRequest{Key: "order"})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		job := resp.Data[0]
		require.JSONEq(t, `{}`, job.Args)
		require.Equal(t, rivertype.JobStateCompleted, job.State)
		require.NotNil(t, job.FinalizedAt)
		require.NotEmpty(t, job.Kind)
	})

	t.Run("ExtractRaw", func(t *testing.T) {
		t.Parallel()

		httpReq := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/pro/sequence/jobs?key=a%2Fb%2Bc%3D&after_id=42&limit=200", nil)
		req := new(sequenceJobListRequest)
		require.NoError(t, req.ExtractRaw(httpReq))
		require.Equal(t, &sequenceJobListRequest{AfterID: new(int64(42)), Key: "a/b+c=", Limit: 200}, req)

		for _, url := range []string{
			"/?key=k&after_id=1&before_id=2",
			"/?key=k&after_id=nope",
			"/?key=k&before_id=nope",
			"/?key=k&limit=nope",
		} {
			httpReq := httptest.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			require.Error(t, new(sequenceJobListRequest).ExtractRaw(httpReq), url)
		}
	})

	t.Run("Validation", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, NewSequenceJobListEndpoint)
		for _, req := range []*sequenceJobListRequest{
			{},
			{Key: "k", AfterID: new(int64(-1))},
			{Key: "k", BeforeID: new(int64(-1))},
			{Key: "k", Limit: 1001},
			{Key: "k", Limit: -1},
		} {
			_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), req)
			require.Error(t, err)
		}
	})
}
