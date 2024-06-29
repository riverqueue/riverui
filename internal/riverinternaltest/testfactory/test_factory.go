package testfactory

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivertype"
	"github.com/riverqueue/riverui/internal/util/ptrutil"
)

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
