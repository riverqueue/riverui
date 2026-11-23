package riveruidriver

import (
	"cmp"
	"slices"
	"time"

	"github.com/riverqueue/river/rivertype"
)

// JobSequenceGetParams identifies the job whose sequence should be inspected.
type JobSequenceGetParams struct {
	ID     int64
	Schema string
}

// JobSequence contains a snapshot of the sequence's pending head and earliest
// blocker in each state. It deliberately excludes counts and completed history.
type JobSequence struct {
	Blockers     []*SequenceJob     `json:"blockers"`
	FirstPending *SequenceJob       `json:"first_pending"`
	JobID        int64              `json:"job_id"`
	JobState     rivertype.JobState `json:"job_state"`
	Key          string             `json:"key"`
}

// Normalize orders blockers and normalizes timestamps across database drivers.
func (s *JobSequence) Normalize() {
	slices.SortFunc(s.Blockers, func(a, b *SequenceJob) int { return cmp.Compare(a.ID, b.ID) })
	for _, job := range s.Blockers {
		job.ScheduledAt = job.ScheduledAt.UTC()
	}
	if s.FirstPending != nil {
		s.FirstPending.ScheduledAt = s.FirstPending.ScheduledAt.UTC()
	}
}

// WaitReason describes why the inspected job is pending. A later pending job
// still waits for the pending head even when that head is ready for promotion.
func (s *JobSequence) WaitReason() string {
	if s.JobState != rivertype.JobStatePending {
		return "none"
	}
	for _, job := range s.Blockers {
		if job.State == rivertype.JobStateCancelled || job.State == rivertype.JobStateDiscarded {
			return "halted"
		}
	}
	if len(s.Blockers) > 0 || (s.FirstPending != nil && s.FirstPending.ID != s.JobID) {
		return "waiting"
	}
	return "awaiting_promotion"
}

// SequenceJob is the small set of fields needed to identify and explain a
// sequence blocker without loading its arguments, errors, or full metadata.
type SequenceJob struct {
	ID          int64              `json:"id"`
	Kind        string             `json:"kind"`
	Queue       string             `json:"queue"`
	ScheduledAt time.Time          `json:"scheduled_at"`
	State       rivertype.JobState `json:"state"`
}
