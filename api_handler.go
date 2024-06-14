package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
	"github.com/riverqueue/riverui/internal/db"
)

type jobCancelRequest struct {
	JobIDStrings []string `json:"ids"`
}

type apiHandler struct {
	client  *river.Client[pgx.Tx]
	dbPool  *pgxpool.Pool
	queries *db.Queries
}

func (a *apiHandler) JobCancel(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	var payload jobCancelRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	jobIDs, err := stringIDsToInt64s(payload.JobIDStrings)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	updatedJobs := make(map[int64]*rivertype.JobRow)

	if err := pgx.BeginFunc(ctx, a.dbPool, func(tx pgx.Tx) error {
		for _, jobID := range jobIDs {
			job, err := a.client.JobCancelTx(ctx, tx, jobID)
			if err != nil {
				if errors.Is(err, river.ErrNotFound) {
					fmt.Printf("job %d not found\n", jobID)
				}
				return err
			}
			updatedJobs[jobID] = job
		}
		return nil
	}); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	// TODO: return jobs in response, use in frontend instead of invalidating
	writeResponse(ctx, rw, []byte("{\"status\": \"ok\"}"))
}

func writeResponse(ctx context.Context, rw http.ResponseWriter, data []byte) {
	if _, err := rw.Write(data); err != nil {
		logger.ErrorContext(ctx, "error writing response", slog.String("error", err.Error()))
	}
}

func stringIDsToInt64s(strs []string) ([]int64, error) {
	ints := make([]int64, len(strs))
	for i, str := range strs {
		intVal, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid job id: %w", err)
		}
		ints[i] = intVal
	}
	return ints, nil
}

type jobDeleteRequest struct {
	JobIDStrings []string `json:"ids"`
}

func (a *apiHandler) JobDelete(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	var payload jobDeleteRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	jobIDs, err := stringIDsToInt64s(payload.JobIDStrings)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	numDeleted := 0
	if err := pgx.BeginFunc(ctx, a.dbPool, func(tx pgx.Tx) error {
		for _, jobID := range jobIDs {
			_, err := a.client.JobDeleteTx(ctx, tx, jobID)
			if err != nil {
				if errors.Is(rivertype.ErrJobRunning, err) {
					fmt.Printf("job %d is running\n", jobID)
				}
				if errors.Is(err, river.ErrNotFound) {
					fmt.Printf("job %d not found\n", jobID)
				}
				return err
			}
			numDeleted++
		}
		return nil
	}); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	writeResponse(ctx, rw, []byte("{\"status\": \"ok\", \"num_deleted\": "+strconv.Itoa(numDeleted)+"}"))
}

type jobRetryRequest struct {
	JobIDStrings []string `json:"ids"`
}

func (a *apiHandler) JobRetry(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	var payload jobRetryRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	jobIDs, err := stringIDsToInt64s(payload.JobIDStrings)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	if err := pgx.BeginFunc(ctx, a.dbPool, func(tx pgx.Tx) error {
		for _, jobID := range jobIDs {
			if _, err := a.client.JobRetryTx(ctx, tx, jobID); err != nil {
				if errors.Is(err, river.ErrNotFound) {
					fmt.Printf("job %d not found\n", jobID)
				}
				return err
			}
		}
		return nil
	}); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	writeResponse(ctx, rw, []byte("{\"status\": \"ok\"}"))
}

func (a *apiHandler) JobGet(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	idString := req.PathValue("id")
	if idString == "" {
		http.Error(rw, "missing job id", http.StatusBadRequest)
		return
	}

	jobID, err := strconv.ParseInt(idString, 10, 64)
	if err != nil {
		http.Error(rw, fmt.Sprintf("invalid job id: %s", err), http.StatusBadRequest)
		return
	}

	job, err := a.client.JobGet(ctx, jobID)
	if errors.Is(err, river.ErrNotFound) {
		http.Error(rw, "{\"error\": {\"msg\": \"job not found\"}}", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(rw).Encode(riverJobToSerializableJob(*job)); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (a *apiHandler) JobList(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	if err := req.ParseForm(); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	limit, err := limitFromReq(req, 20)
	if err != nil {
		http.Error(rw, fmt.Sprintf("invalid limit: %s", err), http.StatusBadRequest)
		return
	}
	params := river.NewJobListParams().First(limit)

	state := rivertype.JobState(req.Form.Get("state"))
	switch state {
	case "":
		params = params.States(rivertype.JobStateRunning).OrderBy(river.JobListOrderByTime, river.SortOrderAsc)
	case rivertype.JobStateCancelled, rivertype.JobStateCompleted, rivertype.JobStateDiscarded:
		params = params.States(state).OrderBy(river.JobListOrderByTime, river.SortOrderDesc)
	case rivertype.JobStateAvailable, rivertype.JobStateRetryable, rivertype.JobStatePending, rivertype.JobStateRunning, rivertype.JobStateScheduled:
		params = params.States(state)
	default:
		http.Error(rw, "invalid state", http.StatusBadRequest)
		return
	}

	result, err := a.client.JobList(ctx, params)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	if err = json.NewEncoder(rw).Encode(riverJobsToSerializableJobs(result)); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (a *apiHandler) QueueGet(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	name := req.PathValue("name")
	if name == "" {
		http.Error(rw, "missing queue name", http.StatusBadRequest)
		return
	}

	queue, err := a.client.QueueGet(ctx, name)
	if errors.Is(err, river.ErrNotFound) {
		http.Error(rw, "{\"error\": {\"msg\": \"queue not found\"}}", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	countRows, err := a.queries.JobCountByQueueAndState(ctx, []string{name})
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	var count db.JobCountByQueueAndStateRow
	if len(countRows) > 0 {
		count = countRows[0]
	}

	if err := json.NewEncoder(rw).Encode(riverQueueToSerializableQueue(*queue, count.AvailableJobsCount, count.RunningJobsCount)); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (a *apiHandler) QueueList(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	if err := req.ParseForm(); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	limitString := req.Form.Get("limit")
	limit, err := strconv.ParseInt(limitString, 10, 64)
	if err != nil {
		http.Error(rw, fmt.Sprintf("invalid limit: %s", err), http.StatusBadRequest)
		return
	}

	result, err := a.client.QueueList(ctx, river.NewQueueListParams().First(int(limit)))
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	queueNames := make([]string, len(result.Queues))
	for i, queue := range result.Queues {
		queueNames[i] = queue.Name
	}

	countRows, err := a.queries.JobCountByQueueAndState(ctx, queueNames)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	if err = json.NewEncoder(rw).Encode(riverQueuesToSerializableQueues(result.Queues, countRows)); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (a *apiHandler) QueuePause(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	queue := req.PathValue("name")
	if queue == "" {
		http.Error(rw, "missing queue name", http.StatusBadRequest)
		return
	}

	if err := a.client.QueuePause(ctx, queue, nil); err != nil {
		if errors.Is(err, river.ErrNotFound) {
			http.Error(rw, "{\"error\": {\"msg\": \"queue not found\"}}", http.StatusNotFound)
			return
		}
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	writeResponse(ctx, rw, []byte("{\"status\": \"ok\"}"))
}

func (a *apiHandler) QueueResume(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	queue := req.PathValue("name")
	if queue == "" {
		http.Error(rw, "missing queue name", http.StatusBadRequest)
		return
	}

	if err := a.client.QueueResume(ctx, queue, nil); err != nil {
		if errors.Is(err, river.ErrNotFound) {
			http.Error(rw, "{\"error\": {\"msg\": \"queue not found\"}}", http.StatusNotFound)
			return
		}
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	writeResponse(ctx, rw, []byte("{\"status\": \"ok\"}"))
}

func (a *apiHandler) StatesAndCounts(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	countsAndStates, err := a.queries.JobCountByState(ctx)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	statesAndCountsMap := make(map[db.RiverJobState]int64)
	for _, countAndState := range countsAndStates {
		statesAndCountsMap[countAndState.State] = countAndState.Count
	}

	resp := StatesAndCountsResponse{
		Available: statesAndCountsMap[db.RiverJobStateAvailable],
		Cancelled: statesAndCountsMap[db.RiverJobStateCancelled],
		Completed: statesAndCountsMap[db.RiverJobStateCompleted],
		Discarded: statesAndCountsMap[db.RiverJobStateDiscarded],
		Pending:   statesAndCountsMap[db.RiverJobStatePending],
		Retryable: statesAndCountsMap[db.RiverJobStateRetryable],
		Running:   statesAndCountsMap[db.RiverJobStateRunning],
		Scheduled: statesAndCountsMap[db.RiverJobStateScheduled],
	}

	if err = json.NewEncoder(rw).Encode(resp); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

type StatesAndCountsResponse struct {
	Available int64 `json:"available"`
	Cancelled int64 `json:"cancelled"`
	Completed int64 `json:"completed"`
	Discarded int64 `json:"discarded"`
	Pending   int64 `json:"pending"`
	Retryable int64 `json:"retryable"`
	Running   int64 `json:"running"`
	Scheduled int64 `json:"scheduled"`
}

type WorkflowGetResponse struct {
	Tasks []RiverJob `json:"tasks"`
}

func (a *apiHandler) WorkflowGet(rw http.ResponseWriter, req *http.Request) {
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()

	workflowID := req.PathValue("id")
	if workflowID == "" {
		http.Error(rw, "missing workflow id", http.StatusBadRequest)
		return
	}

	dbJobs, err := a.queries.JobListWorkflow(ctx, db.JobListWorkflowParams{
		PaginationLimit:  1000,
		PaginationOffset: 0,
		WorkflowID:       workflowID,
	})
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	if len(dbJobs) == 0 {
		http.Error(rw, "{\"error\": {\"msg\": \"workflow not found\"}}", http.StatusNotFound)
		return
	}

	jobs := internalJobsToSerializableJobs(dbJobs)

	resp := WorkflowGetResponse{}
	resp.Tasks = jobs

	if err = json.NewEncoder(rw).Encode(resp); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

func limitFromReq(req *http.Request, defaultLimit int) (int, error) {
	limitString := req.Form.Get("limit")
	if limitString == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.ParseInt(limitString, 10, 64)
	if err != nil {
		return 0, err
	}
	if limit > 1000 {
		return 1000, nil
	}
	return int(limit), nil
}

type RiverJob struct {
	ID          int64                    `json:"id"`
	Args        json.RawMessage          `json:"args"`
	Attempt     int                      `json:"attempt"`
	AttemptedAt *time.Time               `json:"attempted_at"`
	AttemptedBy []string                 `json:"attempted_by"`
	CreatedAt   time.Time                `json:"created_at"`
	Errors      []rivertype.AttemptError `json:"errors"`
	FinalizedAt *time.Time               `json:"finalized_at"`
	Kind        string                   `json:"kind"`
	MaxAttempts int                      `json:"max_attempts"`
	Metadata    json.RawMessage          `json:"metadata"`
	Priority    int                      `json:"priority"`
	Queue       string                   `json:"queue"`
	ScheduledAt time.Time                `json:"scheduled_at"`
	State       string                   `json:"state"`
	Tags        []string                 `json:"tags"`
}

func internalJobToSerializableJob(internal db.RiverJob) RiverJob {
	errs := make([]rivertype.AttemptError, len(internal.Errors))
	for i, attemptErr := range internal.Errors {
		if err := json.Unmarshal(attemptErr, &errs[i]); err != nil {
			// ignore for now
			fmt.Printf("error unmarshaling attempt error: %s\n", err)
		}
	}

	attemptedBy := internal.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}

	return RiverJob{
		ID:          internal.ID,
		Args:        internal.Args,
		Attempt:     int(internal.Attempt),
		AttemptedAt: timePtr(internal.AttemptedAt),
		AttemptedBy: attemptedBy,
		CreatedAt:   internal.CreatedAt.Time,
		Errors:      errs,
		FinalizedAt: timePtr(internal.FinalizedAt),
		Kind:        internal.Kind,
		MaxAttempts: int(internal.MaxAttempts),
		Metadata:    internal.Metadata,
		Priority:    int(internal.Priority),
		Queue:       internal.Queue,
		State:       string(internal.State),
		ScheduledAt: internal.ScheduledAt.Time.UTC(),
		Tags:        internal.Tags,
	}
}

func internalJobsToSerializableJobs(internal []db.RiverJob) []RiverJob {
	jobs := make([]RiverJob, len(internal))
	for i, internalJob := range internal {
		jobs[i] = internalJobToSerializableJob(internalJob)
	}
	return jobs
}

func riverJobToSerializableJob(riverJob rivertype.JobRow) RiverJob {
	attemptedBy := riverJob.AttemptedBy
	if attemptedBy == nil {
		attemptedBy = []string{}
	}
	errs := riverJob.Errors
	if errs == nil {
		errs = []rivertype.AttemptError{}
	}

	return RiverJob{
		ID:          riverJob.ID,
		Args:        riverJob.EncodedArgs,
		Attempt:     riverJob.Attempt,
		AttemptedAt: riverJob.AttemptedAt,
		AttemptedBy: attemptedBy,
		CreatedAt:   riverJob.CreatedAt,
		Errors:      errs,
		FinalizedAt: riverJob.FinalizedAt,
		Kind:        riverJob.Kind,
		MaxAttempts: riverJob.MaxAttempts,
		Metadata:    riverJob.Metadata,
		Priority:    riverJob.Priority,
		Queue:       riverJob.Queue,
		State:       string(riverJob.State),
		ScheduledAt: riverJob.ScheduledAt.UTC(),
		Tags:        riverJob.Tags,
	}
}

func riverJobsToSerializableJobs(result *river.JobListResult) []RiverJob {
	jobs := make([]RiverJob, len(result.Jobs))
	for i, internalJob := range result.Jobs {
		jobs[i] = riverJobToSerializableJob(*internalJob)
	}
	return jobs
}

type RiverQueue struct {
	CountAvailable int64           `json:"count_available"`
	CountRunning   int64           `json:"count_running"`
	CreatedAt      time.Time       `json:"created_at"`
	Metadata       json.RawMessage `json:"metadata"`
	Name           string          `json:"name"`
	PausedAt       *time.Time      `json:"paused_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

func riverQueueToSerializableQueue(internal rivertype.Queue, available, running int64) RiverQueue {
	return RiverQueue{
		CountAvailable: available,
		CountRunning:   running,
		CreatedAt:      internal.CreatedAt,
		Metadata:       internal.Metadata,
		Name:           internal.Name,
		PausedAt:       internal.PausedAt,
		UpdatedAt:      internal.UpdatedAt,
	}
}

func riverQueuesToSerializableQueues(internal []*rivertype.Queue, counts []db.JobCountByQueueAndStateRow) []RiverQueue {
	countsMap := make(map[string]db.JobCountByQueueAndStateRow)
	for _, count := range counts {
		countsMap[count.Queue] = count
	}

	queues := make([]RiverQueue, len(internal))
	for i, internalQueue := range internal {
		count := countsMap[internalQueue.Name]
		queues[i] = riverQueueToSerializableQueue(*internalQueue, count.AvailableJobsCount, count.RunningJobsCount)
	}
	return queues
}

func timePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	utc := t.Time.UTC()
	return &utc
}
