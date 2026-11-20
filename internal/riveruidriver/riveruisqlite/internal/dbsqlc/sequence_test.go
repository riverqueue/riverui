package dbsqlc

import (
	"database/sql"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

func TestJobSequenceGetQueryPlan(t *testing.T) {
	t.Parallel()

	ctx := t.Context()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	_, err = db.ExecContext(ctx, `
CREATE TABLE river_job (id INTEGER PRIMARY KEY, kind TEXT, queue TEXT, state TEXT, scheduled_at TEXT, metadata TEXT);
CREATE INDEX river_job_sequence_scheduling ON river_job(state, json_extract(metadata, '$.seq_key'), id) WHERE json_type(metadata, '$.seq_key') IS NOT NULL;
CREATE INDEX river_job_sequence_first_pending ON river_job(json_extract(metadata, '$.seq_key'), id, scheduled_at) WHERE json_type(metadata, '$.seq_key') IS NOT NULL AND state = 'pending';
CREATE INDEX river_job_sequence_latest_active ON river_job(json_extract(metadata, '$.seq_key'), id DESC, state) WHERE json_type(metadata, '$.seq_key') IS NOT NULL AND state NOT IN ('pending', 'completed');
WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM ids WHERE id < 10000)
INSERT INTO river_job SELECT id, 'invoice', 'default', 'completed', '2026-11-13T12:00:00Z', '{"seq_key":"invoice"}' FROM ids;
INSERT INTO river_job VALUES (10001, 'invoice', 'default', 'cancelled', '2026-11-13T12:00:00Z', '{"seq_key":"invoice"}');
INSERT INTO river_job VALUES (10002, 'invoice', 'default', 'pending', '2026-11-13T12:00:00Z', '{"seq_key":"invoice"}');
ANALYZE;
`)
	require.NoError(t, err)
	rows, err := db.QueryContext(ctx, "EXPLAIN QUERY PLAN "+jobSequenceGet, int64(10002))
	require.NoError(t, err)
	defer rows.Close()
	scans := 0
	for rows.Next() {
		var id, parent, unused int
		var detail string
		require.NoError(t, rows.Scan(&id, &parent, &unused, &detail))
		require.NotContains(t, detail, "SCAN job", "base-table reads must use sequence indexes")
		if strings.HasPrefix(detail, "SEARCH job ") {
			scans++
			require.Contains(t, detail, "USING")
		}
	}
	require.NoError(t, rows.Err())
	require.GreaterOrEqual(t, scans, 8, "SQLite may inline the target CTE, repeating indexed PK lookups")
}
