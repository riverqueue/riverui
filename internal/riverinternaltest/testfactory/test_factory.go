package testfactory

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivertype"
)

type JobOpts struct {
	Attempt     *int
	AttemptedAt *time.Time
	CreatedAt   *time.Time
	EncodedArgs []byte
	Errors      [][]byte
	FinalizedAt *time.Time
	Kind        *string
	MaxAttempts *int
	Metadata    []byte
	Priority    *int
	Queue       *string
	ScheduledAt *time.Time
	State       *rivertype.JobState
	Tags        []string
}

func Job(ctx context.Context, tb testing.TB, exec riverdriver.Executor, opts *JobOpts) *rivertype.JobRow {
	tb.Helper()

	job, err := exec.JobInsertFull(ctx, Job_Build(tb, opts))
	require.NoError(tb, err)
	return job
}

func Job_Build(tb testing.TB, opts *JobOpts) *riverdriver.JobInsertFullParams {
	tb.Helper()

	if opts == nil {
		opts = &JobOpts{}
	}

	encodedArgs := opts.EncodedArgs
	if opts.EncodedArgs == nil {
		encodedArgs = []byte("{}")
	}

	metadata := opts.Metadata
	if opts.Metadata == nil {
		metadata = []byte("{}")
	}

	tags := opts.Tags
	if tags == nil {
		tags = []string{}
	}

	return &riverdriver.JobInsertFullParams{
		Attempt:     ptrutil.ValOrDefault(opts.Attempt, 0),
		AttemptedAt: opts.AttemptedAt,
		CreatedAt:   opts.CreatedAt,
		EncodedArgs: encodedArgs,
		Errors:      opts.Errors,
		FinalizedAt: opts.FinalizedAt,
		Kind:        ptrutil.ValOrDefault(opts.Kind, "fake_job"),
		MaxAttempts: ptrutil.ValOrDefault(opts.MaxAttempts, river.MaxAttemptsDefault),
		Metadata:    metadata,
		Priority:    ptrutil.ValOrDefault(opts.Priority, river.PriorityDefault),
		Queue:       ptrutil.ValOrDefault(opts.Queue, river.QueueDefault),
		ScheduledAt: opts.ScheduledAt,
		State:       ptrutil.ValOrDefault(opts.State, rivertype.JobStateAvailable),
		Tags:        tags,
	}
}

type QueueOpts struct {
	Metadata  []byte
	Name      *string
	PausedAt  *time.Time
	UpdatedAt *time.Time
}

func Queue(ctx context.Context, tb testing.TB, exec riverdriver.Executor, opts *QueueOpts) *rivertype.Queue {
	tb.Helper()

	if opts == nil {
		opts = &QueueOpts{}
	}

	metadata := opts.Metadata
	if len(opts.Metadata) == 0 {
		metadata = []byte("{}")
	}

	queue, err := exec.QueueCreateOrSetUpdatedAt(ctx, &riverdriver.QueueCreateOrSetUpdatedAtParams{
		Metadata:  metadata,
		Name:      ptrutil.ValOrDefaultFunc(opts.Name, func() string { return fmt.Sprintf("queue_%05d", nextSeq()) }),
		PausedAt:  opts.PausedAt,
		UpdatedAt: opts.UpdatedAt,
	})
	require.NoError(tb, err)
	return queue
}

var seq int64 = 1 //nolint:gochecknoglobals

func nextSeq() int {
	return int(atomic.AddInt64(&seq, 1))
}
