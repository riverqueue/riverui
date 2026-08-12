package riveruidrivertest

import (
	"context"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/testfactory"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
)

func exerciseJobCountByAllStatesCapped(
	ctx context.Context,
	t *testing.T,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()

	t.Run("JobCountByAllStatesCapped", func(t *testing.T) {
		t.Parallel()

		t.Run("ValidatesMax", func(t *testing.T) {
			t.Parallel()

			executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)

			_, err := executor.JobCountByAllStatesCapped(ctx, &riveruidriver.JobCountByAllStatesCappedParams{
				Max:    0,
				Schema: schema,
			})
			require.EqualError(t, err, "count max must be positive")

			_, err = executor.JobCountByAllStatesCapped(ctx, &riveruidriver.JobCountByAllStatesCappedParams{
				Max:    math.MaxInt32,
				Schema: schema,
			})
			require.EqualError(t, err, "count max is too large")
		})

		t.Run("CountsEveryStateExactly", func(t *testing.T) {
			t.Parallel()

			executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
			expected := make(map[rivertype.JobState]int, len(rivertype.JobStates()))
			for stateIndex, state := range rivertype.JobStates() {
				count := stateIndex + 1
				expected[state] = count
				for range count {
					testfactory.Job(ctx, t, executor, &testfactory.JobOpts{Schema: schema, State: &state})
				}
			}

			counts, err := executor.JobCountByAllStatesCapped(ctx, &riveruidriver.JobCountByAllStatesCappedParams{
				Max:    100,
				Schema: schema,
			})
			require.NoError(t, err)
			require.Equal(t, expected, counts)
		})

		t.Run("CapsEachStateIndependently", func(t *testing.T) {
			t.Parallel()

			executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
			insertJobs(ctx, t, executor, schema, rivertype.JobStateAvailable, 4)
			insertJobs(ctx, t, executor, schema, rivertype.JobStateCompleted, 2)
			insertJobs(ctx, t, executor, schema, rivertype.JobStateRunning, 1)

			counts, err := executor.JobCountByAllStatesCapped(ctx, &riveruidriver.JobCountByAllStatesCappedParams{
				Max:    2,
				Schema: schema,
			})
			require.NoError(t, err)

			expected := make(map[rivertype.JobState]int, len(rivertype.JobStates()))
			for _, state := range rivertype.JobStates() {
				expected[state] = 0
			}
			expected[rivertype.JobStateAvailable] = 3
			expected[rivertype.JobStateCompleted] = 2
			expected[rivertype.JobStateRunning] = 1
			require.Equal(t, expected, counts)
		})
	})
}

func exerciseJobCountEstimate(
	ctx context.Context,
	t *testing.T,
	databaseName string,
	driver riveruidriver.Driver,
	executorWithTx func(ctx context.Context, t *testing.T) (riverdriver.Executor, string),
) {
	t.Helper()

	t.Run("JobCountEstimate", func(t *testing.T) {
		t.Parallel()

		t.Run("RejectsInvalidState", func(t *testing.T) {
			t.Parallel()

			executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
			invalidState := rivertype.JobState("invalid")
			_, err := executor.JobCountEstimate(ctx, &riveruidriver.JobCountEstimateParams{
				Schema: schema,
				States: []rivertype.JobState{invalidState},
			})
			require.ErrorContains(t, err, `invalid job state for count estimate: "invalid"`)
		})

		t.Run("ReturnsDatabaseEstimateStrategy", func(t *testing.T) {
			t.Parallel()

			executor, schema := executorWithSchema(ctx, t, driver, executorWithTx)
			insertJobs(ctx, t, executor, schema, rivertype.JobStateCompleted, 100)
			insertJobs(ctx, t, executor, schema, rivertype.JobStateRunning, 10)

			estimateParams := &riveruidriver.JobCountEstimateParams{
				Schema: schema,
				States: []rivertype.JobState{
					rivertype.JobStateCompleted,
					rivertype.JobStateRunning,
				},
			}

			switch databaseName {
			case riverdriver.DatabaseNamePostgres:
				require.NoError(t, executor.Exec(ctx, "ANALYZE river_job"))

				estimates, err := executor.JobCountEstimate(ctx, estimateParams)
				require.NoError(t, err)
				require.Len(t, estimates, len(estimateParams.States))
				require.Positive(t, estimates[rivertype.JobStateCompleted].Count)
				require.NotNil(t, estimates[rivertype.JobStateCompleted].ObservedAt)
				require.Greater(t, estimates[rivertype.JobStateCompleted].Count, estimates[rivertype.JobStateRunning].Count)
			case riverdriver.DatabaseNameSQLite:
				estimates, err := executor.JobCountEstimate(ctx, estimateParams)
				require.NoError(t, err)
				require.Empty(t, estimates)
			default:
				t.Fatalf("unsupported database %q", databaseName)
			}
		})
	})
}

func insertJobs(ctx context.Context, t *testing.T, executor riverdriver.Executor, schema string, state rivertype.JobState, count int) {
	t.Helper()

	for range count {
		testfactory.Job(ctx, t, executor, &testfactory.JobOpts{Schema: schema, State: &state})
	}
}
