-- This is a minimal representation with only enough schema for sqlc to enable
-- the River UI queries currently defined below. Expand it toward River's full
-- table definition if future UI queries need additional columns.
CREATE TABLE river_job (
    id integer PRIMARY KEY,
    priority integer NOT NULL DEFAULT 1,
    queue text NOT NULL DEFAULT 'default',
    state text NOT NULL DEFAULT 'available',
    scheduled_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Built-in table populated by a full ANALYZE when SQLite is compiled with the
-- non-default SQLITE_ENABLE_STAT4 option. Most SQLite builds omit STAT4, and
-- approximate ANALYZE does not populate it, so this is an uncommon optional
-- optimization path. Declaring its shape here is only for sqlc.
CREATE TABLE sqlite_stat4 (
    tbl text NOT NULL,
    idx text NOT NULL,
    neq text NOT NULL,
    nlt text NOT NULL,
    ndlt text NOT NULL,
    sample blob NOT NULL
);

-- name: JobCountByAllStatesCapped :one
-- Each subquery follows the remaining columns of River's prioritized fetching
-- index so the database can stop its index scan as soon as the limit is met.
SELECT
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'available' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_available) AS available,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'cancelled' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_cancelled) AS cancelled,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'completed' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_completed) AS completed,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'discarded' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_discarded) AS discarded,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'pending' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_pending) AS pending,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'retryable' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_retryable) AS retryable,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'running' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_running) AS running,
    (SELECT count(*) FROM (SELECT 1 FROM /* TEMPLATE: schema */river_job WHERE state = 'scheduled' ORDER BY queue, priority, scheduled_at, id LIMIT @max) AS limited_scheduled) AS scheduled;

-- name: JobCountEstimateStat4 :one
-- When the uncommon STAT4 data is available, aggregate its small number of
-- encoded index samples into one scalar because River's cross-database
-- executor exposes QueryRow only.
SELECT CAST(coalesce(group_concat(neq || ':' || hex(sample), '|'), '') AS text) AS samples
FROM /* TEMPLATE: schema */sqlite_stat4
WHERE tbl = 'river_job' AND idx = 'river_job_prioritized_fetching_index';
