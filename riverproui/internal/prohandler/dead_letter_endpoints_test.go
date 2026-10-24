package prohandler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro/driver"

	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

func insertDeadLetterJob(ctx context.Context, t *testing.T, bundle *setupEndpointTestBundle) *rivertype.JobRow {
	t.Helper()
	params := testfactory.Job_Build(t, &testfactory.JobOpts{
		Attempt:     new(3),
		EncodedArgs: []byte(`{"id":1970670598291982290}`),
		FinalizedAt: new(time.Now()),
		Priority:    new(1),
		Queue:       new("mail"),
		State:       new(rivertype.JobStateDiscarded),
		Errors:      [][]byte{[]byte(`{"at":"2026-10-21T00:00:00Z","attempt":3,"error":"delivery failed"}`)},
	})
	params.Schema = bundle.schema
	job, err := bundle.exec.JobInsertFull(ctx, params)
	require.NoError(t, err)
	job, err = bundle.exec.JobDeadLetterMoveByID(ctx, &driver.JobDeadLetterMoveByIDParams{ID: job.ID, Schema: bundle.schema})
	require.NoError(t, err)
	return job
}

func TestDeadLetterJobList(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobListEndpoint)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{})
	require.NoError(t, err)
	require.Empty(t, resp.Data)
	encoded, err := json.Marshal(resp)
	require.NoError(t, err)
	require.JSONEq(t, `{"data":[]}`, string(encoded))

	job := insertDeadLetterJob(ctx, t, bundle)
	liveParams := testfactory.Job_Build(t, nil)
	liveParams.Schema = bundle.schema
	_, err = bundle.exec.JobInsertFull(ctx, liveParams)
	require.NoError(t, err)

	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{})
	require.NoError(t, err)
	require.Len(t, resp.Data, 1)
	require.Equal(t, job.ID, resp.Data[0].ID)
	require.Equal(t, "mail", resp.Data[0].Queue)
	require.Equal(t, job.MaxAttempts, resp.Data[0].MaxAttempts)
	require.WithinDuration(t, *job.FinalizedAt, *resp.Data[0].FinalizedAt, time.Millisecond)
	encoded, err = json.Marshal(resp)
	require.NoError(t, err)
	require.Contains(t, string(encoded), fmt.Sprintf(`"id":"%d"`, job.ID))
	var newest *rivertype.JobRow
	for range 24 {
		newest = insertDeadLetterJob(ctx, t, bundle)
	}
	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{})
	require.NoError(t, err)
	require.Len(t, resp.Data, 20)
	require.Equal(t, newest.ID, resp.Data[0].ID, "newest jobs must come first")
	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{Limit: new(2)})
	require.NoError(t, err)
	require.Len(t, resp.Data, 2)
	require.Greater(t, resp.Data[0].ID, resp.Data[1].ID)
	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{Limit: new(40)})
	require.NoError(t, err)
	require.Len(t, resp.Data, 25)
	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{
		IDs: []int64{job.ID}, Kinds: []string{job.Kind}, Priorities: []int16{1}, Queues: []string{"mail"}, Limit: new(1),
	})
	require.NoError(t, err)
	require.Len(t, resp.Data, 1)
	require.Equal(t, job.ID, resp.Data[0].ID)
	resp, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{Queues: []string{"missing"}})
	require.NoError(t, err)
	require.Empty(t, resp.Data)
	for _, invalid := range []*deadLetterJobListRequest{
		{IDs: []int64{0}},
		{IDs: []int64{-1}},
		{IDs: make([]int64, 1001)},
		{Priorities: []int16{0}},
		{Priorities: []int16{5}},
		{Kinds: []string{""}},
		{Queues: []string{strings.Repeat("x", 1025)}},
		{Tags: make([]string, 101)},
	} {
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), invalid)
		require.Error(t, err)
	}
	for _, limit := range []int{-1, 0, 201} {
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{Limit: &limit})
		require.Error(t, err)
	}
}

func TestDeadLetterJobGet(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobGetEndpoint)
	job := insertDeadLetterJob(ctx, t, bundle)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: job.ID})
	require.NoError(t, err)
	require.Equal(t, job.ID, resp.ID)
	require.Len(t, resp.Errors, 1)
	require.Equal(t, "delivery failed", resp.Errors[0].Error)

	_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: job.ID + 1})
	require.EqualError(t, err, fmt.Sprintf("Dead letter job with ID %d not found. It may already have been retried.", job.ID+1))
}

func TestDeadLetterJobRetry(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobRetryEndpoint)
	job := insertDeadLetterJob(ctx, t, bundle)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: job.ID})
	require.NoError(t, err)
	require.NotEqual(t, job.ID, resp.ID)
	require.Equal(t, string(rivertype.JobStateAvailable), resp.State)
	require.Zero(t, resp.Attempt)
	require.Empty(t, resp.Errors)
	require.Equal(t, string(job.EncodedArgs), resp.Args)
	require.Equal(t, job.Queue, resp.Queue)

	_, err = bundle.exec.JobDeadLetterGetByID(ctx, &driver.JobDeadLetterGetByIDParams{ID: job.ID, Schema: bundle.schema})
	require.ErrorIs(t, err, rivertype.ErrNotFound)
	live, err := bundle.exec.JobGetByID(ctx, &riverdriver.JobGetByIDParams{ID: resp.ID, Schema: bundle.schema})
	require.NoError(t, err)
	require.Equal(t, rivertype.JobStateAvailable, live.State)

	_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: job.ID})
	require.EqualError(t, err, fmt.Sprintf("Dead letter job with ID %d not found. It may already have been retried.", job.ID))
	_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: live.ID})
	require.EqualError(t, err, fmt.Sprintf("Dead letter job with ID %d not found. It may already have been retried.", live.ID))
}

func TestDeadLetterJobRetryUniqueConflict(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobRetryEndpoint)

	params := testfactory.Job_Build(t, nil)
	params.Schema = bundle.schema
	params.UniqueKey = []byte("dead-letter-unique-job")
	params.UniqueStates = 0xff
	job, err := bundle.exec.JobInsertFull(ctx, params)
	require.NoError(t, err)
	_, err = bundle.exec.JobDeadLetterMoveByID(ctx, &driver.JobDeadLetterMoveByIDParams{ID: job.ID, Schema: bundle.schema})
	require.NoError(t, err)
	_, err = bundle.exec.JobInsertFull(ctx, params)
	require.NoError(t, err)

	_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: job.ID})
	require.ErrorContains(t, err, "another active job has the same unique properties")
	_, err = bundle.exec.JobDeadLetterGetByID(ctx, &driver.JobDeadLetterGetByIDParams{ID: job.ID, Schema: bundle.schema})
	require.NoError(t, err, "a conflict must retain the dead letter job")
}

func TestDeadLetterJobRequest(t *testing.T) {
	t.Parallel()
	for _, id := range []string{"invalid", "9223372036854775808"} {
		t.Run(id, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
			req.SetPathValue("job_id", id)
			require.Error(t, (&deadLetterJobRequest{}).ExtractRaw(req))
		})
	}
}

func TestDeadLetterJobSerialization(t *testing.T) {
	t.Parallel()
	encoded, err := json.Marshal(serializableDeadLetterJob(&rivertype.JobRow{ID: 1970670598291982290}))
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"id":"1970670598291982290"`)
	require.Contains(t, string(encoded), `"errors":[]`)
}

func TestDeadLetterJobListRequest(t *testing.T) {
	t.Parallel()
	for _, query := range []string{"limit=invalid", "limit=1.5", "limit=9223372036854775808", "ids=bad", "ids=1.5", "ids=9223372036854775808", "priorities=bad", "priorities=32768"} {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?"+query, nil)
		require.Error(t, (&deadLetterJobListRequest{}).ExtractRaw(req))
	}
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?limit=40&ids=1970670598291982290&ids=9223372036854775807&kinds=report&kinds=email&priorities=1&priorities=3&queues=mail&tags=urgent&tags=batch", nil)
	var parsed deadLetterJobListRequest
	require.NoError(t, parsed.ExtractRaw(req))
	require.Equal(t, new(40), parsed.Limit)
	require.Equal(t, []int64{1970670598291982290, 9223372036854775807}, parsed.IDs)
	require.Equal(t, []int16{1, 3}, parsed.Priorities)
	require.Equal(t, []string{"report", "email"}, parsed.Kinds)
	require.Equal(t, []string{"mail"}, parsed.Queues)
	require.Equal(t, []string{"urgent", "batch"}, parsed.Tags)
}

func TestDeadLetterAutocomplete(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterAutocompleteEndpoint)
	job := insertDeadLetterJob(ctx, t, bundle)
	for _, tt := range []struct {
		request deadLetterAutocompleteRequest
		want    []string
	}{
		{request: deadLetterAutocompleteRequest{Facet: "job_kind"}, want: []string{job.Kind}},
		{request: deadLetterAutocompleteRequest{Facet: "queue_name", Match: "MA"}, want: []string{"mail"}},
		{request: deadLetterAutocompleteRequest{Facet: "queue_name", Exclude: []string{"mail"}}, want: []string{}},
	} {
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &tt.request)
		require.NoError(t, err)
		got := make([]string, 0, len(resp.Data))
		for _, value := range resp.Data {
			got = append(got, *value)
		}
		require.Equal(t, tt.want, got)
	}
	for _, facet := range []string{"", "tags", "id"} {
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterAutocompleteRequest{Facet: facet})
		require.Error(t, err)
	}
}
