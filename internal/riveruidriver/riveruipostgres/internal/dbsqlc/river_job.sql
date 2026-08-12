CREATE TYPE river_job_state AS ENUM(
    'available',
    'cancelled',
    'completed',
    'discarded',
    'pending',
    'retryable',
    'running',
    'scheduled'
);

-- This is a minimal representation with only enough schema for sqlc to enable
-- the River UI queries currently defined below. Expand it toward River's full
-- table definition if future UI queries need additional columns.
CREATE TABLE river_job (
    id bigserial PRIMARY KEY,
    priority smallint NOT NULL DEFAULT 1,
    queue text NOT NULL DEFAULT 'default',
    state river_job_state NOT NULL DEFAULT 'available',
    scheduled_at timestamptz NOT NULL DEFAULT now()
);

-- Minimal catalog view definition needed by sqlc to type-check the statistics
-- query. PostgreSQL provides the real pg_stat_all_tables view at runtime.
CREATE TABLE pg_stat_all_tables (
    schemaname text NOT NULL,
    relname text NOT NULL,
    last_analyze timestamptz,
    last_autoanalyze timestamptz
);

-- name: JobCountByAllStatesCapped :one
-- Each subquery follows the remaining columns of River's prioritized fetching
-- index so the database can stop its index scan as soon as the limit is met.
SELECT
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'available' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_available) AS available,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'cancelled' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_cancelled) AS cancelled,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'completed' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_completed) AS completed,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'discarded' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_discarded) AS discarded,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'pending' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_pending) AS pending,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'retryable' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_retryable) AS retryable,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'running' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_running) AS running,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'scheduled' ORDER BY queue, priority, scheduled_at, id LIMIT @max::int) AS limited_scheduled) AS scheduled;

-- name: JobCountAnalyzedAt :one
SELECT GREATEST(last_analyze, last_autoanalyze)::timestamptz AS analyzed_at
FROM pg_stat_all_tables
WHERE schemaname = COALESCE(NULLIF(@schema::text, ''), current_schema())
  AND relname = 'river_job';

-- These queries intentionally embed a state literal. A parameterized query can
-- eventually receive PostgreSQL's generic prepared plan, which loses the
-- per-state selectivity that makes the estimate useful.

-- name: JobCountEstimateAvailable :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'available';

-- name: JobCountEstimateCancelled :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'cancelled';

-- name: JobCountEstimateCompleted :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'completed';

-- name: JobCountEstimateDiscarded :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'discarded';

-- name: JobCountEstimatePending :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'pending';

-- name: JobCountEstimateRetryable :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'retryable';

-- name: JobCountEstimateRunning :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'running';

-- name: JobCountEstimateScheduled :one
EXPLAIN (FORMAT JSON) SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'scheduled';
