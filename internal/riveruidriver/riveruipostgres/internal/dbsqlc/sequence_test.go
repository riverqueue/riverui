package dbsqlc

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivershared/riversharedtest"
)

func TestJobSequenceGetQueryPlan(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	tx, err := riversharedtest.DBPool(ctx, t).Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(ctx) })

	// A large completed history in the inspected sequence and many unrelated
	// sequences must not turn a diagnostic request into a full table scan.
	_, err = tx.Exec(ctx, `
CREATE TEMP TABLE river_job (
    id bigint PRIMARY KEY, kind text NOT NULL DEFAULT 'invoice', queue text NOT NULL DEFAULT 'default',
    state text NOT NULL, scheduled_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL
) ON COMMIT DROP;
CREATE INDEX river_job_sequence_scheduling ON river_job (state, (metadata->>'seq_key'), id) WHERE metadata ? 'seq_key';
CREATE INDEX river_job_sequence_first_pending ON river_job ((metadata->>'seq_key'), id) INCLUDE (scheduled_at) WHERE metadata ? 'seq_key' AND state = 'pending';
CREATE INDEX river_job_sequence_latest_active ON river_job ((metadata->>'seq_key'), id DESC) INCLUDE (state) WHERE metadata ? 'seq_key' AND state NOT IN ('pending', 'completed');
INSERT INTO river_job (id, state, metadata)
SELECT i, 'completed', '{"seq_key":"invoice"}' FROM generate_series(1, 50000) i;
INSERT INTO river_job (id, state, metadata)
SELECT i, 'pending', jsonb_build_object('seq_key', 'other-' || i) FROM generate_series(50001, 100000) i;
INSERT INTO river_job (id, state, metadata) VALUES (100001, 'cancelled', '{"seq_key":"invoice"}');
INSERT INTO river_job (id, state, metadata)
SELECT i, 'pending', '{"seq_key":"invoice"}' FROM generate_series(100002, 110001) i;
ANALYZE river_job;
SET LOCAL plan_cache_mode = force_generic_plan;
`)
	require.NoError(t, err)

	query := strings.ReplaceAll(jobSequenceGet, "/* TEMPLATE: schema */", "")
	var rawPlan []byte
	require.NoError(t, tx.QueryRow(ctx, "EXPLAIN (ANALYZE, FORMAT JSON) "+query, int64(110001)).Scan(&rawPlan))
	type planNode struct {
		IndexName    string     `json:"Index Name"`    //nolint:tagliatelle // PostgreSQL defines these keys.
		NodeType     string     `json:"Node Type"`     //nolint:tagliatelle // PostgreSQL defines these keys.
		Plans        []planNode `json:"Plans"`         //nolint:tagliatelle // PostgreSQL defines these keys.
		RelationName string     `json:"Relation Name"` //nolint:tagliatelle // PostgreSQL defines these keys.
	}
	var plans []struct {
		Plan planNode `json:"Plan"` //nolint:tagliatelle // PostgreSQL defines these keys.
	}
	require.NoError(t, json.Unmarshal(rawPlan, &plans))
	require.Len(t, plans, 1)
	scans := 0
	var visit func(planNode)
	visit = func(node planNode) {
		if node.RelationName == "river_job" {
			scans++
			require.Contains(t, []string{"Index Scan", "Index Only Scan"}, node.NodeType, "%s", rawPlan)
			require.NotEmpty(t, node.IndexName)
		}
		for _, child := range node.Plans {
			visit(child)
		}
	}
	visit(plans[0].Plan)
	require.Equal(t, 8, scans, "one PK lookup, one pending head, and six blocker probes")
}
