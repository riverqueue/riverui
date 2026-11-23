package riveruidrivertest

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/testfactory"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
)

func exerciseJobSequenceGet(ctx context.Context, t *testing.T, driver riveruidriver.Driver, executorWithTx func(context.Context, *testing.T) (riverdriver.Executor, string)) {
	t.Helper()

	t.Run("JobSequenceGet", func(t *testing.T) {
		t.Parallel()

		type testBundle struct {
			exec    riveruidriver.Executor
			insert  func(rivertype.JobState, string) *rivertype.JobRow
			inspect func(int64) *riveruidriver.JobSequence
			prefix  string
		}
		setup := func(t *testing.T) *testBundle {
			t.Helper()
			exec, schema := executorWithSchema(ctx, t, driver, executorWithTx)
			prefix := ""
			if schema != "" {
				prefix = dbutil.SafeIdentifier(schema) + "."
			}
			return &testBundle{
				exec: exec,
				insert: func(state rivertype.JobState, metadata string) *rivertype.JobRow {
					return testfactory.Job(ctx, t, exec, &testfactory.JobOpts{Metadata: []byte(metadata), Schema: schema, State: &state})
				},
				inspect: func(id int64) *riveruidriver.JobSequence {
					result, err := exec.JobSequenceGet(ctx, &riveruidriver.JobSequenceGetParams{ID: id, Schema: schema})
					require.NoError(t, err)
					return result
				},
				prefix: prefix,
			}
		}

		for _, state := range []rivertype.JobState{rivertype.JobStateAvailable, rivertype.JobStateCancelled, rivertype.JobStateDiscarded, rivertype.JobStateRetryable, rivertype.JobStateRunning, rivertype.JobStateScheduled} {
			t.Run(string(state), func(t *testing.T) {
				t.Parallel()
				bundle := setup(t)
				// Completed history and other keys must never become blockers.
				bundle.insert(rivertype.JobStateCompleted, `{"seq_key":"invoice"}`)
				bundle.insert(rivertype.JobStateCancelled, `{"seq_key":"other"}`)
				blocker := bundle.insert(state, `{"seq_key":"invoice"}`)
				first := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice","seq_continue_cancelled":true,"seq_continue_discarded":true}`)
				last := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
				result := bundle.inspect(last.ID)
				require.Equal(t, "invoice", result.Key)
				require.Equal(t, last.ID, result.JobID)
				require.Equal(t, first.ID, result.FirstPending.ID)
				require.Len(t, result.Blockers, 1)
				require.Equal(t, blocker.ID, result.Blockers[0].ID)
				require.Equal(t, blocker.Kind, result.Blockers[0].Kind)
				require.Equal(t, blocker.Queue, result.Blockers[0].Queue)
				require.Equal(t, state, result.Blockers[0].State)
				if state == rivertype.JobStateCancelled || state == rivertype.JobStateDiscarded {
					require.Equal(t, "halted", result.WaitReason())
				} else {
					require.Equal(t, "waiting", result.WaitReason())
				}
				require.Equal(t, "none", bundle.inspect(blocker.ID).WaitReason())
			})
		}

		t.Run("ActiveAfterPendingHead", func(t *testing.T) {
			t.Parallel()
			bundle := setup(t)
			first := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
			active := bundle.insert(rivertype.JobStateRunning, `{"seq_key":"invoice"}`)
			result := bundle.inspect(first.ID)
			require.Equal(t, "waiting", result.WaitReason())
			require.Len(t, result.Blockers, 1)
			require.Equal(t, active.ID, result.Blockers[0].ID)
		})

		t.Run("ContinuationAndTerminalPosition", func(t *testing.T) {
			t.Parallel()
			bundle := setup(t)
			bundle.insert(rivertype.JobStateCancelled, `{"seq_key":"invoice","seq_continue_cancelled":true}`)
			bundle.insert(rivertype.JobStateDiscarded, `{"seq_key":"invoice","seq_continue_discarded":true}`)
			first := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
			bundle.insert(rivertype.JobStateCancelled, `{"seq_key":"invoice"}`)
			bundle.insert(rivertype.JobStateDiscarded, `{"seq_key":"invoice"}`)
			last := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
			result := bundle.inspect(first.ID)
			require.Empty(t, result.Blockers)
			require.Equal(t, "awaiting_promotion", result.WaitReason())
			require.Equal(t, "waiting", bundle.inspect(last.ID).WaitReason())
		})

		t.Run("EarliestBlockerPerState", func(t *testing.T) {
			t.Parallel()
			bundle := setup(t)
			cancelled := bundle.insert(rivertype.JobStateCancelled, `{"seq_key":"invoice"}`)
			bundle.insert(rivertype.JobStateCancelled, `{"seq_key":"invoice"}`)
			discarded := bundle.insert(rivertype.JobStateDiscarded, `{"seq_key":"invoice"}`)
			pending := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
			result := bundle.inspect(pending.ID)
			require.Len(t, result.Blockers, 2)
			require.Equal(t, cancelled.ID, result.Blockers[0].ID)
			require.Equal(t, discarded.ID, result.Blockers[1].ID)
		})

		t.Run("MissingAndNonSequence", func(t *testing.T) {
			t.Parallel()
			bundle := setup(t)
			require.Nil(t, bundle.inspect(9223372036854775807))
			for _, metadata := range []string{`{}`, `{"seq_key":null}`, `{"seq_key":123}`, `{"seq_key":""}`} {
				job := bundle.insert(rivertype.JobStatePending, metadata)
				require.Nil(t, bundle.inspect(job.ID))
			}
		})

		t.Run("Recovery", func(t *testing.T) {
			t.Parallel()
			bundle := setup(t)
			blocker := bundle.insert(rivertype.JobStateDiscarded, `{"seq_key":"invoice"}`)
			pending := bundle.insert(rivertype.JobStatePending, `{"seq_key":"invoice"}`)
			require.Equal(t, "halted", bundle.inspect(pending.ID).WaitReason())
			require.NoError(t, bundle.exec.Exec(ctx, fmt.Sprintf("UPDATE %sriver_job SET state = 'pending', finalized_at = NULL WHERE id = %d", bundle.prefix, blocker.ID)))
			result := bundle.inspect(pending.ID)
			require.Equal(t, blocker.ID, result.FirstPending.ID)
			require.Equal(t, "waiting", result.WaitReason())
			require.NoError(t, bundle.exec.Exec(ctx, fmt.Sprintf("DELETE FROM %sriver_job WHERE id = %d", bundle.prefix, blocker.ID)))
			require.Equal(t, "awaiting_promotion", bundle.inspect(pending.ID).WaitReason())
		})
	})
}
