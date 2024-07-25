-- name: WorkflowListActive :many
WITH workflow_ids AS (
    SELECT DISTINCT ON (workflow_id) metadata->>'workflow_id' AS workflow_id
    FROM river_job
    WHERE state IN ('available', 'pending', 'retryable', 'running', 'scheduled')
        AND metadata ? 'workflow_id'
        AND metadata->>'workflow_id' > @after::text
    ORDER BY workflow_id DESC
    LIMIT @pagination_limit::integer
)

SELECT
    (river_job.metadata->>'workflow_id')::text AS workflow_id,
    coalesce(river_job.metadata->>'workflow_name', '')::text AS workflow_name,
    MIN(river_job.created_at)::timestamptz AS earliest_created_at,
    COUNT(*) FILTER (WHERE river_job.metadata ? 'workflow_deps_failed_at') AS count_failed_deps,
    COUNT(*) FILTER (WHERE river_job.state = 'available') AS count_available,
    COUNT(*) FILTER (WHERE river_job.state = 'cancelled') AS count_cancelled,
    COUNT(*) FILTER (WHERE river_job.state = 'completed') AS count_completed,
    COUNT(*) FILTER (WHERE river_job.state = 'discarded') AS count_discarded,
    COUNT(*) FILTER (WHERE river_job.state = 'pending') AS count_pending,
    COUNT(*) FILTER (WHERE river_job.state = 'retryable') AS count_retryable,
    COUNT(*) FILTER (WHERE river_job.state = 'running') AS count_running,
    COUNT(*) FILTER (WHERE river_job.state = 'scheduled') AS count_scheduled
FROM river_job
INNER JOIN workflow_ids
    ON river_job.metadata->>'workflow_id' = workflow_ids.workflow_id
WHERE
    river_job.metadata ? 'workflow_id'
GROUP BY river_job.metadata->>'workflow_id', metadata->>'workflow_name'
ORDER BY river_job.metadata->>'workflow_id' DESC;

-- name: WorkflowListAll :many
SELECT
    (river_job.metadata->>'workflow_id')::text AS workflow_id,
    coalesce(river_job.metadata->>'workflow_name', '')::text AS workflow_name,
    MIN(river_job.created_at)::timestamptz AS earliest_created_at,
    COUNT(*) FILTER (WHERE river_job.metadata ? 'workflow_deps_failed_at') AS count_failed_deps,
    COUNT(*) FILTER (WHERE river_job.state = 'available') AS count_available,
    COUNT(*) FILTER (WHERE river_job.state = 'cancelled') AS count_cancelled,
    COUNT(*) FILTER (WHERE river_job.state = 'completed') AS count_completed,
    COUNT(*) FILTER (WHERE river_job.state = 'discarded') AS count_discarded,
    COUNT(*) FILTER (WHERE river_job.state = 'pending') AS count_pending,
    COUNT(*) FILTER (WHERE river_job.state = 'retryable') AS count_retryable,
    COUNT(*) FILTER (WHERE river_job.state = 'running') AS count_running,
    COUNT(*) FILTER (WHERE river_job.state = 'scheduled') AS count_scheduled
FROM river_job
WHERE
    river_job.metadata ? 'workflow_id'
    AND river_job.metadata->>'workflow_id' > @after::text
GROUP BY river_job.metadata->>'workflow_id', metadata->>'workflow_name'
ORDER BY river_job.metadata->>'workflow_id' DESC
LIMIT @pagination_limit::integer;

-- name: WorkflowListInactive :many
WITH active_workflow_ids AS (
    SELECT DISTINCT ON (workflow_id) metadata->>'workflow_id' AS workflow_id
    FROM river_job
    WHERE state IN ('available', 'pending', 'retryable', 'running', 'scheduled')
        AND metadata->>'workflow_id' > @after::text
    AND metadata ? 'workflow_id'
    ORDER BY workflow_id DESC
)

SELECT
    (river_job.metadata->>'workflow_id')::text AS workflow_id,
    coalesce(river_job.metadata->>'workflow_name', '')::text AS workflow_name,
    MIN(river_job.created_at)::timestamptz AS earliest_created_at,
    COUNT(*) FILTER (WHERE river_job.metadata ? 'workflow_deps_failed_at') AS count_failed_deps,
    COUNT(*) FILTER (WHERE river_job.state = 'available') AS count_available,
    COUNT(*) FILTER (WHERE river_job.state = 'cancelled') AS count_cancelled,
    COUNT(*) FILTER (WHERE river_job.state = 'completed') AS count_completed,
    COUNT(*) FILTER (WHERE river_job.state = 'discarded') AS count_discarded,
    COUNT(*) FILTER (WHERE river_job.state = 'pending') AS count_pending,
    COUNT(*) FILTER (WHERE river_job.state = 'retryable') AS count_retryable,
    COUNT(*) FILTER (WHERE river_job.state = 'running') AS count_running,
    COUNT(*) FILTER (WHERE river_job.state = 'scheduled') AS count_scheduled
FROM river_job
WHERE
  state IN ('completed', 'cancelled', 'discarded')
  AND metadata ? 'workflow_id'
  AND metadata ->> 'workflow_id' NOT IN (SELECT workflow_id FROM active_workflow_ids)
GROUP BY metadata->>'workflow_id', metadata->>'workflow_name'
ORDER BY workflow_id DESC
LIMIT @pagination_limit::integer;
