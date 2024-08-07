-- name: JobCountByState :many
SELECT state, count(*)
FROM river_job
GROUP BY state;

-- name: JobListWorkflow :many
SELECT
  *
FROM
  river_job
WHERE
  metadata @> jsonb_build_object('workflow_id', @workflow_id::text)
ORDER BY
  id ASC
LIMIT @pagination_limit::integer
OFFSET @pagination_offset::bigint;

-- name: JobCountByQueueAndState :many
WITH all_queues AS (
  SELECT unnest(@queue_names::text[])::text AS queue
),

running_job_counts AS (
  SELECT
    queue,
    COUNT(*) AS count
  FROM
    river_job
  WHERE
    queue = ANY(@queue_names::text[]) AND
    state = 'running'
  GROUP BY queue
),

available_job_counts AS (
  SELECT
    queue,
    COUNT(*) AS count
  FROM
    river_job
  WHERE
    queue = ANY(@queue_names::text[]) AND
    state = 'available'
  GROUP BY queue
)

SELECT
    all_queues.queue,
    COALESCE(available_job_counts.count, 0) AS count_available,
    COALESCE(running_job_counts.count, 0) AS count_running
FROM
    all_queues
LEFT JOIN
    running_job_counts ON all_queues.queue = running_job_counts.queue
LEFT JOIN
    available_job_counts ON all_queues.queue = available_job_counts.queue;
