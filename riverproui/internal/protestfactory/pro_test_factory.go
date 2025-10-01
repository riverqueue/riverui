package protestfactory

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivershared/util/ptrutil"

	"riverqueue.com/riverpro/driver"
)

type PeriodicJobOpts struct {
	ID        *string
	NextRunAt *time.Time
	UpdatedAt *time.Time
}

func PeriodicJob(ctx context.Context, tb testing.TB, exec driver.ProExecutor, opts *PeriodicJobOpts) *driver.PeriodicJob {
	tb.Helper()

	if opts == nil {
		opts = &PeriodicJobOpts{}
	}

	periodicJob, err := exec.PeriodicJobInsert(ctx, &driver.PeriodicJobInsertParams{
		ID:        ptrutil.ValOrDefaultFunc(opts.ID, func() string { return fmt.Sprintf("periodic_job_%05d", nextSeq()) }),
		NextRunAt: ptrutil.ValOrDefaultFunc(opts.NextRunAt, time.Now),
		UpdatedAt: opts.UpdatedAt,
		Schema:    "",
	})
	require.NoError(tb, err)
	return periodicJob
}

var seq int64 = 1 //nolint:gochecknoglobals

func nextSeq() int {
	return int(atomic.AddInt64(&seq, 1))
}
