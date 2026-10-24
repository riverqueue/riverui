-- Minimal schema for the Pro-only dead letter list query. River Pro owns the
-- real table and its migrations.
CREATE TABLE river_job_dead_letter (
    id integer PRIMARY KEY,
    attempt integer NOT NULL,
    finalized_at timestamp,
    kind text NOT NULL,
    max_attempts integer NOT NULL,
    queue text NOT NULL,
    priority integer NOT NULL DEFAULT 1,
    tags text NOT NULL
);

-- name: JobDeadLetterList :one
-- Return the newest jobs first. Apply the limit before aggregation so neither
-- the database nor the browser materializes the entire queue. SQLite doesn't
-- guarantee that json_group_array preserves the subquery's order, so the
-- driver sorts the decoded rows. Normalize SQLite timestamps to RFC 3339 for
-- the shared result decoder; strftime preserves NULL timestamps. Its %f keeps
-- milliseconds, where PostgreSQL returns microseconds.
--
-- This query ignores the filter's IDs; the driver sends ID lookups to
-- JobDeadLetterListByIDs instead.
SELECT CAST(json_group_array(json_object(
    'id', limited.id,
    'attempt', limited.attempt,
    'finalized_at', strftime('%Y-%m-%dT%H:%M:%fZ', limited.finalized_at),
    'kind', limited.kind,
    'max_attempts', limited.max_attempts,
    'queue', limited.queue
)) AS text) AS jobs
FROM (
    SELECT id, attempt, finalized_at, kind, max_attempts, queue
    FROM /* TEMPLATE: schema */river_job_dead_letter
    WHERE (json_type(CAST(@filters AS text), '$.kinds') IS NULL OR kind IN (SELECT CAST(value AS text) FROM json_each(CAST(@filters AS text), '$.kinds')))
      AND (json_type(CAST(@filters AS text), '$.priorities') IS NULL OR priority IN (SELECT CAST(value AS integer) FROM json_each(CAST(@filters AS text), '$.priorities')))
      AND (json_type(CAST(@filters AS text), '$.queues') IS NULL OR queue IN (SELECT CAST(value AS text) FROM json_each(CAST(@filters AS text), '$.queues')))
      AND (json_type(CAST(@filters AS text), '$.tags') IS NULL OR EXISTS (SELECT 1 FROM json_each(river_job_dead_letter.tags) AS job_tag JOIN json_each(CAST(@filters AS text), '$.tags') AS filter_tag ON job_tag.value = filter_tag.value))
    ORDER BY id DESC
    LIMIT @max
) AS limited;

-- name: JobDeadLetterListByIDs :one
-- JobDeadLetterList for filters that include IDs. The ID predicate must stand
-- alone as a top-level condition: written as "no IDs requested OR id IN (...)"
-- SQLite scans the whole table instead of searching the primary key.
SELECT CAST(json_group_array(json_object(
    'id', limited.id,
    'attempt', limited.attempt,
    'finalized_at', strftime('%Y-%m-%dT%H:%M:%fZ', limited.finalized_at),
    'kind', limited.kind,
    'max_attempts', limited.max_attempts,
    'queue', limited.queue
)) AS text) AS jobs
FROM (
    SELECT id, attempt, finalized_at, kind, max_attempts, queue
    FROM /* TEMPLATE: schema */river_job_dead_letter
    WHERE id IN (SELECT CAST(value AS integer) FROM json_each(CAST(@filters AS text), '$.ids'))
      AND (json_type(CAST(@filters AS text), '$.kinds') IS NULL OR kind IN (SELECT CAST(value AS text) FROM json_each(CAST(@filters AS text), '$.kinds')))
      AND (json_type(CAST(@filters AS text), '$.priorities') IS NULL OR priority IN (SELECT CAST(value AS integer) FROM json_each(CAST(@filters AS text), '$.priorities')))
      AND (json_type(CAST(@filters AS text), '$.queues') IS NULL OR queue IN (SELECT CAST(value AS text) FROM json_each(CAST(@filters AS text), '$.queues')))
      AND (json_type(CAST(@filters AS text), '$.tags') IS NULL OR EXISTS (SELECT 1 FROM json_each(river_job_dead_letter.tags) AS job_tag JOIN json_each(CAST(@filters AS text), '$.tags') AS filter_tag ON job_tag.value = filter_tag.value))
    ORDER BY id DESC
    LIMIT @max
) AS limited;

-- name: JobDeadLetterAutocomplete :one
-- Suggest values from the archive, including kinds and queues with no live jobs.
--
-- SQLite's built-in lower() folds only ASCII letters and its default BINARY
-- collation sorts values by their bytes. The PostgreSQL query pins the "C"
-- collation to behave the same way. A SQLite build that loads the ICU
-- extension replaces lower() with a Unicode-aware version and would also fold
-- non-ASCII letters.
SELECT CAST(json_group_array(suggestions.value) AS text) AS values_json
FROM (
    SELECT DISTINCT candidates.value
    FROM (
        SELECT CASE WHEN CAST(@facet AS text) = 'job_kind' THEN kind ELSE queue END AS value
        FROM /* TEMPLATE: schema */river_job_dead_letter
    ) AS candidates
    WHERE substr(lower(candidates.value), 1, length(CAST(@match AS text))) = lower(CAST(@match AS text))
      AND candidates.value NOT IN (SELECT value FROM json_each(CAST(@exclude AS text)))
    ORDER BY candidates.value
    LIMIT @max
) AS suggestions;
