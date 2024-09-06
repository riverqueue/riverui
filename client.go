package riverui

import (
	"context"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"
)

type Client[TTx any] interface {
	Driver() riverdriver.Driver[TTx]

	JobCancel(ctx context.Context, jobID int64) (*rivertype.JobRow, error)
	JobCancelTx(ctx context.Context, tx TTx, jobID int64) (*rivertype.JobRow, error)
	JobDelete(ctx context.Context, id int64) (*rivertype.JobRow, error)
	JobDeleteTx(ctx context.Context, tx TTx, id int64) (*rivertype.JobRow, error)
	JobGet(ctx context.Context, id int64) (*rivertype.JobRow, error)
	JobGetTx(ctx context.Context, tx TTx, id int64) (*rivertype.JobRow, error)
	JobList(ctx context.Context, params *river.JobListParams) (*river.JobListResult, error)
	JobListTx(ctx context.Context, tx TTx, params *river.JobListParams) (*river.JobListResult, error)
	JobRetry(ctx context.Context, id int64) (*rivertype.JobRow, error)
	JobRetryTx(ctx context.Context, tx TTx, id int64) (*rivertype.JobRow, error)

	QueueGet(ctx context.Context, name string) (*rivertype.Queue, error)
	QueueGetTx(ctx context.Context, tx TTx, name string) (*rivertype.Queue, error)
	QueueList(ctx context.Context, params *river.QueueListParams) (*river.QueueListResult, error)
	QueueListTx(ctx context.Context, tx TTx, params *river.QueueListParams) (*river.QueueListResult, error)
	QueuePause(ctx context.Context, name string, opts *river.QueuePauseOpts) error
	QueuePauseTx(ctx context.Context, tx TTx, name string, opts *river.QueuePauseOpts) error
	QueueResume(ctx context.Context, name string, opts *river.QueuePauseOpts) error
	QueueResumeTx(ctx context.Context, tx TTx, name string, opts *river.QueuePauseOpts) error
	Queues() *river.QueueBundle

	// ID() string
	// Insert(ctx context.Context, args river.JobArgs, opts *river.InsertOpts) (*rivertype.JobInsertResult, error)
	// InsertMany(ctx context.Context, params []river.InsertManyParams) (int, error)
	// InsertManyTx(ctx context.Context, tx TTx, params []river.InsertManyParams) (int, error)
	// InsertTx(ctx context.Context, tx TTx, args river.JobArgs, opts *river.InsertOpts) (*rivertype.JobInsertResult, error)
	// PeriodicJobs() *river.PeriodicJobBundle
	// Start(ctx context.Context) error
	// Stop(ctx context.Context) error
	// StopAndCancel(ctx context.Context) error
	// Stopped() <-chan struct{}
	// Subscribe(kinds ...river.EventKind) (<-chan *river.Event, func())
	// SubscribeConfig(config *river.SubscribeConfig) (<-chan *river.Event, func())
}
