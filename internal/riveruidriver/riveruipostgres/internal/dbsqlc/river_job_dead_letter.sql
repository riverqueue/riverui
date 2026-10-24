-- Minimal schema for the Pro-only dead letter list query. River Pro owns the
-- real table and its migrations.
CREATE TABLE river_job_dead_letter (
    id bigint PRIMARY KEY,
    attempt smallint NOT NULL,
    finalized_at timestamptz,
    kind text NOT NULL,
    max_attempts smallint NOT NULL,
    queue text NOT NULL,
    priority smallint NOT NULL DEFAULT 1,
    tags varchar(255)[] NOT NULL
);

-- name: JobDeadLetterList :one
-- Return the newest jobs first. Apply the limit before aggregation so neither
-- the database nor the browser materializes the entire queue. River's common
-- executor exposes QueryRow, so return the bounded set as one JSON value.
--
-- This query ignores the filter's IDs; the driver sends ID lookups to
-- JobDeadLetterListByIDs instead.
SELECT coalesce(json_agg(json_build_object(
    'id', limited.id,
    'attempt', limited.attempt,
    'finalized_at', limited.finalized_at,
    'kind', limited.kind,
    'max_attempts', limited.max_attempts,
    'queue', limited.queue
) ORDER BY limited.id DESC), '[]'::json)::text AS jobs
FROM (
    SELECT id, attempt, finalized_at, kind, max_attempts, queue
    FROM /* TEMPLATE: schema */river_job_dead_letter
    WHERE (NOT jsonb_exists(@filters::jsonb, 'kinds') OR kind IN (SELECT value::text FROM jsonb_array_elements_text(@filters::jsonb -> 'kinds')))
      AND (NOT jsonb_exists(@filters::jsonb, 'priorities') OR priority IN (SELECT value::smallint FROM jsonb_array_elements_text(@filters::jsonb -> 'priorities')))
      AND (NOT jsonb_exists(@filters::jsonb, 'queues') OR queue IN (SELECT value::text FROM jsonb_array_elements_text(@filters::jsonb -> 'queues')))
      AND (NOT jsonb_exists(@filters::jsonb, 'tags') OR tags && ARRAY(SELECT jsonb_array_elements_text(@filters::jsonb -> 'tags'))::varchar[])
    ORDER BY id DESC
    LIMIT @max::int
) AS limited;

-- name: JobDeadLetterListByIDs :one
-- JobDeadLetterList for filters that include IDs. The ID predicate must stand
-- alone as a top-level condition: written as "no IDs requested OR id IN (...)"
-- the planner can't turn it into an index condition and reads the whole
-- table. Collapsing the requested IDs to an array lets it probe the primary
-- key once per ID, whether the statement runs with a custom or generic plan.
SELECT coalesce(json_agg(json_build_object(
    'id', limited.id,
    'attempt', limited.attempt,
    'finalized_at', limited.finalized_at,
    'kind', limited.kind,
    'max_attempts', limited.max_attempts,
    'queue', limited.queue
) ORDER BY limited.id DESC), '[]'::json)::text AS jobs
FROM (
    SELECT id, attempt, finalized_at, kind, max_attempts, queue
    FROM /* TEMPLATE: schema */river_job_dead_letter
    WHERE id = ANY (ARRAY(SELECT value::bigint FROM jsonb_array_elements_text(@filters::jsonb -> 'ids')))
      AND (NOT jsonb_exists(@filters::jsonb, 'kinds') OR kind IN (SELECT value::text FROM jsonb_array_elements_text(@filters::jsonb -> 'kinds')))
      AND (NOT jsonb_exists(@filters::jsonb, 'priorities') OR priority IN (SELECT value::smallint FROM jsonb_array_elements_text(@filters::jsonb -> 'priorities')))
      AND (NOT jsonb_exists(@filters::jsonb, 'queues') OR queue IN (SELECT value::text FROM jsonb_array_elements_text(@filters::jsonb -> 'queues')))
      AND (NOT jsonb_exists(@filters::jsonb, 'tags') OR tags && ARRAY(SELECT jsonb_array_elements_text(@filters::jsonb -> 'tags'))::varchar[])
    ORDER BY id DESC
    LIMIT @max::int
) AS limited;

-- name: JobDeadLetterAutocomplete :one
-- Suggest values from the archive, including kinds and queues with no live jobs.
--
-- The "C" collation makes matching and ordering independent of the database's
-- collation and identical to SQLite: lower() folds only ASCII letters, and
-- values sort by their bytes. The ordering matters before the limit as well,
-- because it decides which suggestions are returned.
SELECT coalesce(json_agg(suggestions.value ORDER BY suggestions.value COLLATE "C"), '[]'::json)::text AS values
FROM (
    SELECT DISTINCT candidates.value
    FROM (
        SELECT (CASE WHEN @facet::text = 'job_kind' THEN kind ELSE queue END) COLLATE "C" AS value
        FROM /* TEMPLATE: schema */river_job_dead_letter
    ) AS candidates
    WHERE left(lower(candidates.value COLLATE "C"), length(@match::text)) = lower((@match::text) COLLATE "C")
      AND candidates.value NOT IN (SELECT excluded.value COLLATE "C" FROM jsonb_array_elements_text(@exclude::jsonb) AS excluded(value))
    ORDER BY candidates.value
    LIMIT @max::int
) AS suggestions;
