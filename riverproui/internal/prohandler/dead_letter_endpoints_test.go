package prohandler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverpro/driver"

	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/riveruidriver"
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
	require.Len(t, resp.Data, riveruidriver.JobDeadLetterListMaxDefault)
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
	for _, limit := range []int{-1, 0, riveruidriver.JobDeadLetterListMaxLimit + 1} {
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{Limit: &limit})
		require.Error(t, err)
	}
}

// The validate tags can't refer to constants, so check that they agree with the
// limits and facets that the drivers enforce.
func TestDeadLetterRequestTagsMatchDriver(t *testing.T) {
	t.Parallel()

	validateTag := func(request any, fieldName string) string {
		field, ok := reflect.TypeOf(request).FieldByName(fieldName)
		require.True(t, ok)
		return field.Tag.Get("validate")
	}
	require.Equal(t,
		fmt.Sprintf("omitempty,min=1,max=%d", riveruidriver.JobDeadLetterListMaxLimit),
		validateTag(deadLetterJobListRequest{}, "Limit"))
	require.Equal(t,
		fmt.Sprintf("required,oneof=%s %s", riveruidriver.JobDeadLetterFacetJobKind, riveruidriver.JobDeadLetterFacetQueueName),
		validateTag(deadLetterAutocompleteRequest{}, "Facet"))
}

// validDeadLetterIDs and validDeadLetterValues return slices whose elements
// pass validation, so that only the size of the slice is under test.
func validDeadLetterIDs(count int) []int64 {
	ids := make([]int64, count)
	for i := range ids {
		ids[i] = int64(i) + 1
	}
	return ids
}

func validDeadLetterValues(count int) []string {
	values := make([]string, count)
	for i := range values {
		values[i] = fmt.Sprintf("value_%d", i)
	}
	return values
}

func TestDeadLetterJobListValidation(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, _ := setupEndpoint(ctx, t, NewDeadLetterJobListEndpoint)

	const (
		tooManyElements = "must contain at most %d element(s)"
		tooLong         = "must be at most 1024 character(s) long"
		required        = "is required"
	)
	for _, tt := range []struct {
		name    string
		request *deadLetterJobListRequest
		wantErr string // empty when the request is valid
	}{
		{name: "IDsAtLimit", request: &deadLetterJobListRequest{IDs: validDeadLetterIDs(1000)}},
		{name: "IDsOverLimit", request: &deadLetterJobListRequest{IDs: validDeadLetterIDs(1001)}, wantErr: fmt.Sprintf(tooManyElements, 1000)},
		{name: "IDZero", request: &deadLetterJobListRequest{IDs: []int64{0}}, wantErr: "must be greater or equal to 1"},
		{name: "IDNegative", request: &deadLetterJobListRequest{IDs: []int64{-1}}, wantErr: "must be greater or equal to 1"},
		{name: "KindsAtLimit", request: &deadLetterJobListRequest{Kinds: validDeadLetterValues(100)}},
		{name: "KindsOverLimit", request: &deadLetterJobListRequest{Kinds: validDeadLetterValues(101)}, wantErr: fmt.Sprintf(tooManyElements, 100)},
		{name: "KindAtLength", request: &deadLetterJobListRequest{Kinds: []string{strings.Repeat("x", 1024)}}},
		{name: "KindOverLength", request: &deadLetterJobListRequest{Kinds: []string{strings.Repeat("x", 1025)}}, wantErr: tooLong},
		{name: "KindEmpty", request: &deadLetterJobListRequest{Kinds: []string{""}}, wantErr: required},
		{name: "QueuesAtLimit", request: &deadLetterJobListRequest{Queues: validDeadLetterValues(100)}},
		{name: "QueuesOverLimit", request: &deadLetterJobListRequest{Queues: validDeadLetterValues(101)}, wantErr: fmt.Sprintf(tooManyElements, 100)},
		{name: "QueueAtLength", request: &deadLetterJobListRequest{Queues: []string{strings.Repeat("x", 1024)}}},
		{name: "QueueOverLength", request: &deadLetterJobListRequest{Queues: []string{strings.Repeat("x", 1025)}}, wantErr: tooLong},
		{name: "QueueEmpty", request: &deadLetterJobListRequest{Queues: []string{""}}, wantErr: required},
		{name: "TagsAtLimit", request: &deadLetterJobListRequest{Tags: validDeadLetterValues(100)}},
		{name: "TagsOverLimit", request: &deadLetterJobListRequest{Tags: validDeadLetterValues(101)}, wantErr: fmt.Sprintf(tooManyElements, 100)},
		{name: "TagAtLength", request: &deadLetterJobListRequest{Tags: []string{strings.Repeat("x", 1024)}}},
		{name: "TagOverLength", request: &deadLetterJobListRequest{Tags: []string{strings.Repeat("x", 1025)}}, wantErr: tooLong},
		{name: "TagEmpty", request: &deadLetterJobListRequest{Tags: []string{""}}, wantErr: required},
		{name: "PrioritiesAll", request: &deadLetterJobListRequest{Priorities: []int16{1, 2, 3, 4}}},
		{name: "PrioritiesOverLimit", request: &deadLetterJobListRequest{Priorities: []int16{1, 2, 3, 4, 1}}, wantErr: fmt.Sprintf(tooManyElements, 4)},
		{name: "PriorityZero", request: &deadLetterJobListRequest{Priorities: []int16{0}}, wantErr: "min"},
		{name: "PriorityTooHigh", request: &deadLetterJobListRequest{Priorities: []int16{5}}, wantErr: "max"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), tt.request)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			var badRequest *apierror.BadRequest
			require.ErrorAs(t, err, &badRequest)
			require.Equal(t, http.StatusBadRequest, badRequest.StatusCode)
			require.Contains(t, badRequest.Message, tt.wantErr)
		})
	}
}

func TestDeadLetterAutocompleteValidation(t *testing.T) {
	t.Parallel()
	ctx := t.Context()
	endpoint, _ := setupEndpoint(ctx, t, NewDeadLetterAutocompleteEndpoint)

	const tooLong = "must be at most 1024 character(s) long"
	for _, tt := range []struct {
		name    string
		request *deadLetterAutocompleteRequest
		wantErr string // empty when the request is valid
	}{
		{name: "MatchAtLength", request: &deadLetterAutocompleteRequest{Facet: "job_kind", Match: strings.Repeat("x", 1024)}},
		{name: "MatchOverLength", request: &deadLetterAutocompleteRequest{Facet: "job_kind", Match: strings.Repeat("x", 1025)}, wantErr: tooLong},
		{name: "ExcludeAtLimit", request: &deadLetterAutocompleteRequest{Facet: "job_kind", Exclude: validDeadLetterValues(100)}},
		{name: "ExcludeOverLimit", request: &deadLetterAutocompleteRequest{Facet: "job_kind", Exclude: validDeadLetterValues(101)}, wantErr: "must contain at most 100 element(s)"},
		{name: "ExcludeValueAtLength", request: &deadLetterAutocompleteRequest{Facet: "queue_name", Exclude: []string{strings.Repeat("x", 1024)}}},
		{name: "ExcludeValueOverLength", request: &deadLetterAutocompleteRequest{Facet: "queue_name", Exclude: []string{strings.Repeat("x", 1025)}}, wantErr: tooLong},
		{name: "FacetMissing", request: &deadLetterAutocompleteRequest{}, wantErr: "is required"},
		{name: "FacetUnknown", request: &deadLetterAutocompleteRequest{Facet: "tags"}, wantErr: "should be one of the following values: job_kind queue_name"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), tt.request)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			var badRequest *apierror.BadRequest
			require.ErrorAs(t, err, &badRequest)
			require.Equal(t, http.StatusBadRequest, badRequest.StatusCode)
			require.Contains(t, badRequest.Message, tt.wantErr)
		})
	}
}

// Every dead letter endpoint must report a missing table as a bad request that
// names the migration, rather than failing in a query.
func TestDeadLetterJobsRequireTable(t *testing.T) {
	t.Parallel()
	ctx := t.Context()

	dropTable := func(t *testing.T, bundle *setupEndpointTestBundle) {
		t.Helper()
		require.NoError(t, bundle.exec.Exec(ctx, "DROP TABLE "+dbutil.SafeIdentifier(bundle.schema)+"."+deadLetterTableName))

		exists, err := HasDeadLetterTable(ctx, bundle.exec, bundle.schema)
		require.NoError(t, err)
		require.False(t, exists)
	}
	requireMissingTableError := func(t *testing.T, err error) {
		t.Helper()
		var badRequest *apierror.BadRequest
		require.ErrorAs(t, err, &badRequest)
		require.Equal(t, http.StatusBadRequest, badRequest.StatusCode)
		require.Equal(t, "Dead letter jobs require River Pro's dead letter queue migration.", badRequest.Message)
	}

	t.Run("List", func(t *testing.T) {
		t.Parallel()
		endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobListEndpoint)
		exists, err := HasDeadLetterTable(ctx, bundle.exec, bundle.schema)
		require.NoError(t, err)
		require.True(t, exists)
		dropTable(t, bundle)
		_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobListRequest{})
		requireMissingTableError(t, err)
	})
	t.Run("Autocomplete", func(t *testing.T) {
		t.Parallel()
		endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterAutocompleteEndpoint)
		dropTable(t, bundle)
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterAutocompleteRequest{Facet: "job_kind"})
		requireMissingTableError(t, err)
	})
	t.Run("Get", func(t *testing.T) {
		t.Parallel()
		endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobGetEndpoint)
		dropTable(t, bundle)
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: 1})
		requireMissingTableError(t, err)
	})
	t.Run("Retry", func(t *testing.T) {
		t.Parallel()
		endpoint, bundle := setupEndpoint(ctx, t, NewDeadLetterJobRetryEndpoint)
		dropTable(t, bundle)
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: 1})
		requireMissingTableError(t, err)
	})
}

func requireDeadLetterNotFound(t *testing.T, err error, jobID int64) {
	t.Helper()
	var notFound *apierror.NotFound
	require.ErrorAs(t, err, &notFound)
	require.Equal(t, http.StatusNotFound, notFound.StatusCode)
	require.Equal(t, fmt.Sprintf("Dead letter job with ID %d not found. It may already have been retried.", jobID), notFound.Message)
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
	requireDeadLetterNotFound(t, err, job.ID+1)
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
	requireDeadLetterNotFound(t, err, job.ID)
	_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterJobRequest{JobID: live.ID})
	requireDeadLetterNotFound(t, err, live.ID)
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
	var apiErr *apierror.APIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, http.StatusConflict, apiErr.StatusCode)
	require.Equal(t, "Job can't be retried because another active job has the same unique properties. Wait for it to finish before retrying.", apiErr.Message)
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

func TestDeadLetterJobListItemSerialization(t *testing.T) {
	t.Parallel()

	finalizedAt := time.Date(2026, time.October, 21, 10, 2, 3, 456_000_000, time.UTC)
	encoded, err := json.Marshal(deadLetterJobListItemFromDriver(&riveruidriver.JobDeadLetterListResult{
		ID: 1970670598291982290, Attempt: 3, FinalizedAt: &finalizedAt, Kind: "send_email", MaxAttempts: 5, Queue: "mail",
	}))
	require.NoError(t, err)
	require.JSONEq(t, `{"id":"1970670598291982290","attempt":3,"finalized_at":"2026-10-21T10:02:03.456Z","kind":"send_email","max_attempts":5,"queue":"mail"}`, string(encoded))

	encoded, err = json.Marshal(deadLetterJobListItemFromDriver(&riveruidriver.JobDeadLetterListResult{ID: 1}))
	require.NoError(t, err)
	require.JSONEq(t, `{"id":"1","attempt":0,"finalized_at":null,"kind":"","max_attempts":0,"queue":""}`, string(encoded))
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

func TestDeadLetterRequestRejectsInvalidText(t *testing.T) {
	t.Parallel()

	extractList := func(r *http.Request) error { return (&deadLetterJobListRequest{}).ExtractRaw(r) }
	extractAutocomplete := func(r *http.Request) error { return (&deadLetterAutocompleteRequest{}).ExtractRaw(r) }
	for _, tt := range []struct {
		param   string
		extract func(r *http.Request) error
	}{
		{param: "kinds", extract: extractList},
		{param: "queues", extract: extractList},
		{param: "tags", extract: extractList},
		{param: "match", extract: extractAutocomplete},
		{param: "exclude", extract: extractAutocomplete},
	} {
		// A NUL byte alone and within text, then invalid UTF-8 sequences.
		for _, value := range []string{"%00", "send%00email", "%ff", "caf%c3"} {
			t.Run(tt.param+"="+value, func(t *testing.T) {
				t.Parallel()
				req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?facet=job_kind&kinds=valid&"+tt.param+"="+value, nil)
				err := tt.extract(req)
				var badRequest *apierror.BadRequest
				require.ErrorAs(t, err, &badRequest)
				require.Equal(t, http.StatusBadRequest, badRequest.StatusCode)
				require.Equal(t, "Invalid `"+tt.param+"` value: must be valid UTF-8 without NUL bytes.", badRequest.Message)
			})
		}
	}

	// Other control characters and non-ASCII text are valid in both databases.
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?kinds=caf%C3%A9&queues=tab%09bed&tags=%C3%BCber", nil)
	var parsed deadLetterJobListRequest
	require.NoError(t, parsed.ExtractRaw(req))
	require.Equal(t, []string{"café"}, parsed.Kinds)
	require.Equal(t, []string{"tab\tbed"}, parsed.Queues)
	require.Equal(t, []string{"über"}, parsed.Tags)
}

// Requests go through the mounted endpoint so that a value PostgreSQL rejects
// is shown to produce a bad request rather than an internal server error.
func TestDeadLetterInvalidTextStatus(t *testing.T) {
	t.Parallel()
	ctx := t.Context()

	listEndpoint, _ := setupEndpoint(ctx, t, NewDeadLetterJobListEndpoint)
	autocompleteEndpoint, _ := setupEndpoint(ctx, t, NewDeadLetterAutocompleteEndpoint)
	mux := http.NewServeMux()
	apiendpoint.Mount(mux, listEndpoint, testMountOpts(t))
	apiendpoint.Mount(mux, autocompleteEndpoint, testMountOpts(t))

	for _, tt := range []struct {
		path string
		want int
	}{
		{path: "/api/pro/dead-letter-jobs?kinds=%00", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs?queues=%00", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs?tags=%ff", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs?kinds=caf%C3%A9&tags=tab%09bed", want: http.StatusOK},
		{path: "/api/pro/dead-letter-jobs/autocomplete?facet=job_kind&match=%00", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs/autocomplete?facet=job_kind&match=%ff", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs/autocomplete?facet=job_kind&exclude=%00", want: http.StatusBadRequest},
		{path: "/api/pro/dead-letter-jobs/autocomplete?facet=job_kind&match=caf%C3%A9", want: http.StatusOK},
	} {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequestWithContext(ctx, http.MethodGet, tt.path, nil))
		require.Equal(t, tt.want, recorder.Code, "%s: %s", tt.path, recorder.Body.String())
	}
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
	for _, facet := range []riveruidriver.JobDeadLetterFacet{"", "tags", "id"} {
		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &deadLetterAutocompleteRequest{Facet: facet})
		var badRequest *apierror.BadRequest
		require.ErrorAs(t, err, &badRequest)
	}
}
