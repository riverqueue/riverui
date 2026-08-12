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
