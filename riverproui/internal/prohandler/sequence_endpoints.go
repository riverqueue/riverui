package prohandler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
)

// HasSequenceDiagnostics reports whether the sequence scheduling index is
// installed. Table existence alone is insufficient to promise an indexed lookup.
func HasSequenceDiagnostics(ctx context.Context, exec riverdriver.Executor, schema string) (bool, error) {
	return exec.IndexExists(ctx, &riverdriver.IndexExistsParams{Index: "river_job_sequence_scheduling", Schema: schema})
}

type jobSequenceGetEndpoint[TTx any] struct {
	ProAPIBundle[TTx]
	apiendpoint.Endpoint[jobSequenceGetRequest, jobSequenceResponse]

	uiDriver riveruidriver.Driver
}

// NewJobSequenceGetEndpoint returns the sequence diagnostics endpoint.
func NewJobSequenceGetEndpoint[TTx any](bundle ProAPIBundle[TTx]) *jobSequenceGetEndpoint[TTx] {
	return &jobSequenceGetEndpoint[TTx]{ProAPIBundle: bundle, uiDriver: uiDriverForDatabase(bundle.Driver.DatabaseName())}
}

func (a *jobSequenceGetEndpoint[TTx]) Execute(ctx context.Context, req *jobSequenceGetRequest) (*jobSequenceResponse, error) {
	// Keep a diagnostic request from occupying a connection indefinitely when
	// a sequence contains an unusually large retained failure history.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	supported, err := HasSequenceDiagnostics(ctx, a.DB, a.Client.Schema())
	if err != nil {
		return nil, fmt.Errorf("error checking sequence index: %w", err)
	}
	if !supported {
		return nil, apierror.NewBadRequest("Sequence diagnostics require River Pro's sequence scheduling index. Run the Pro migrations.")
	}

	sequence, err := a.uiDriver.GetExecutor(a.DB).JobSequenceGet(ctx, &riveruidriver.JobSequenceGetParams{
		ID: req.JobID, Schema: a.Client.Schema(),
	})
	if err != nil {
		return nil, fmt.Errorf("error getting job sequence: %w", err)
	}
	if sequence == nil {
		return nil, apierror.NewNotFoundf("Sequence for job %d not found.", req.JobID)
	}
	blockers := make([]*sequenceJobResponse, 0, len(sequence.Blockers))
	for _, job := range sequence.Blockers {
		blockers = append(blockers, sequenceJobFromDriver(job))
	}
	return &jobSequenceResponse{
		Blockers:     blockers,
		FirstPending: sequenceJobFromDriver(sequence.FirstPending),
		JobID:        sequence.JobID,
		Key:          sequence.Key,
		WaitReason:   sequence.WaitReason(),
	}, nil
}

func (*jobSequenceGetEndpoint[TTx]) Meta() *apiendpoint.EndpointMeta {
	return &apiendpoint.EndpointMeta{Pattern: "GET /api/pro/jobs/{job_id}/sequence", StatusCode: http.StatusOK}
}

type jobSequenceGetRequest struct {
	JobID int64 `json:"-" validate:"required,min=1"`
}

func (req *jobSequenceGetRequest) ExtractRaw(r *http.Request) error {
	id, err := strconv.ParseInt(r.PathValue("job_id"), 10, 64)
	if err != nil {
		return apierror.NewBadRequestf("Couldn't convert job ID to int64: %s.", err)
	}
	req.JobID = id
	return nil
}

type jobSequenceResponse struct {
	Blockers     []*sequenceJobResponse `json:"blockers"`
	FirstPending *sequenceJobResponse   `json:"first_pending"`
	JobID        int64                  `json:"job_id,string"`
	Key          string                 `json:"key"`
	WaitReason   string                 `json:"wait_reason"`
}

type sequenceJobResponse struct {
	ID          int64              `json:"id,string"`
	Kind        string             `json:"kind"`
	Queue       string             `json:"queue"`
	ScheduledAt time.Time          `json:"scheduled_at"`
	State       rivertype.JobState `json:"state"`
}

func sequenceJobFromDriver(job *riveruidriver.SequenceJob) *sequenceJobResponse {
	if job == nil {
		return nil
	}
	return &sequenceJobResponse{ID: job.ID, Kind: job.Kind, Queue: job.Queue, ScheduledAt: job.ScheduledAt, State: job.State}
}
