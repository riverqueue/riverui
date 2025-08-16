package querycacher

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/riversharedtest"
	"github.com/riverqueue/river/rivershared/startstoptest"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riverinternaltest"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
)

func TestQueryCacher(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	type testBundle struct {
		exec riverdriver.ExecutorTx
	}

	setup := func(ctx context.Context, t *testing.T) (*QueryCacher[map[rivertype.JobState]int], *testBundle) {
		t.Helper()

		var (
			archetype = riversharedtest.BaseServiceArchetype(t)
			driver    = riverpgxv5.New(nil)
			tx        = riverinternaltest.TestTx(ctx, t)
			runQuery  = func(ctx context.Context) (map[rivertype.JobState]int, error) {
				return driver.UnwrapExecutor(tx).JobCountByAllStates(ctx, &riverdriver.JobCountByAllStatesParams{Schema: ""})
			}
			queryCacher = NewQueryCacher(archetype, runQuery)
		)

		return queryCacher, &testBundle{
			exec: driver.UnwrapExecutor(tx),
		}
	}

	start := func(ctx context.Context, t *testing.T, queryCacher *QueryCacher[map[rivertype.JobState]int]) {
		t.Helper()

		require.NoError(t, queryCacher.Start(ctx))
		t.Cleanup(queryCacher.Stop)
	}

	t.Run("NoCachedResult", func(t *testing.T) {
		t.Parallel()

		queryCacher, _ := setup(ctx, t)

		_, ok := queryCacher.CachedRes()
		require.False(t, ok)
	})

	t.Run("WithCachedResult", func(t *testing.T) {
		t.Parallel()

		queryCacher, bundle := setup(ctx, t)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		_, err := queryCacher.RunQuery(ctx)
		require.NoError(t, err)

		res, ok := queryCacher.CachedRes()
		require.True(t, ok)
		require.Equal(t, map[rivertype.JobState]int{
			rivertype.JobStateAvailable: 1,
			rivertype.JobStateCancelled: 0,
			rivertype.JobStateCompleted: 0,
			rivertype.JobStateDiscarded: 0,
			rivertype.JobStatePending:   0,
			rivertype.JobStateRetryable: 0,
			rivertype.JobStateRunning:   0,
			rivertype.JobStateScheduled: 0,
		}, res)
	})

	t.Run("RunsPeriodically", func(t *testing.T) {
		t.Parallel()

		queryCacher, bundle := setup(ctx, t)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		runQueryTestChan := make(chan struct{})
		queryCacher.runQueryTestChan = runQueryTestChan

		// Dramatically reduce tick period so we don't have to wait the full time.
		queryCacher.tickPeriod = 1 * time.Millisecond

		start(ctx, t, queryCacher)

		riversharedtest.WaitOrTimeout(t, runQueryTestChan)

		res, ok := queryCacher.CachedRes()
		require.True(t, ok)
		require.Equal(t, map[rivertype.JobState]int{
			rivertype.JobStateAvailable: 1,
			rivertype.JobStateCancelled: 0,
			rivertype.JobStateCompleted: 0,
			rivertype.JobStateDiscarded: 0,
			rivertype.JobStatePending:   0,
			rivertype.JobStateRetryable: 0,
			rivertype.JobStateRunning:   0,
			rivertype.JobStateScheduled: 0,
		}, res)
	})

	t.Run("StartStopStress", func(t *testing.T) {
		t.Parallel()

		queryCacher, _ := setup(ctx, t)
		startstoptest.Stress(ctx, t, queryCacher)
	})
}

func TestSimplifyArchetypeLogName(t *testing.T) {
	t.Parallel()

	require.Equal(t, "NotGeneric", simplifyArchetypeLogName("NotGeneric"))

	// Simplified for use during debugging. Real generics will tend to have
	// fully qualified paths and not look like this.
	require.Equal(t, "Simple[int]", simplifyArchetypeLogName("Simple[int]"))
	require.Equal(t, "Simple[*int]", simplifyArchetypeLogName("Simple[*int]"))
	require.Equal(t, "Simple[[]int]", simplifyArchetypeLogName("Simple[[]int]"))
	require.Equal(t, "Simple[[]*int]", simplifyArchetypeLogName("Simple[[]*int]"))

	// More realistic examples.
	require.Equal(t, "QueryCacher[map[rivertype.JobState]int]", simplifyArchetypeLogName("QueryCacher[map[rivertype.JobState]int]"))
	require.Equal(t, "QueryCacher[*map[rivertype.JobState]int]", simplifyArchetypeLogName("QueryCacher[*map[rivertype.JobState]int]"))
	require.Equal(t, "QueryCacher[[]map[rivertype.JobState]int]", simplifyArchetypeLogName("QueryCacher[[]map[rivertype.JobState]int]"))
	require.Equal(t, "QueryCacher[[]*map[rivertype.JobState]int]", simplifyArchetypeLogName("QueryCacher[[]*map[rivertype.JobState]int]"))
}
