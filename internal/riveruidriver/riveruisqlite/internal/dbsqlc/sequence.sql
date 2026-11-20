-- Each probe constrains state and sequence key before ordering by ID. This
-- matches River Pro's river_job_sequence_scheduling index and excludes completed
-- history. Separate active-state probes avoid sorting an entire sequence.
-- Terminal blockers must precede the first pending job and use their own
-- continuation flags, matching the sequence supervisor. Active jobs block from
-- anywhere in the sequence, including after its pending head.
-- name: JobSequenceGet :one
WITH target AS (
    SELECT job.id, job.state, json_extract(job.metadata, '$.seq_key') AS seq_key
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.id = @job_id
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_type(job.metadata, '$.seq_key') = 'text'
        AND json_extract(job.metadata, '$.seq_key') <> ''
),
first_pending AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'pending'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
    ORDER BY job.id
    LIMIT 1
),
available_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'available'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
    ORDER BY job.id
    LIMIT 1
),
cancelled_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'cancelled'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
        AND job.id < (SELECT first_pending.id FROM first_pending)
        AND COALESCE(json_extract(job.metadata, '$.seq_continue_cancelled'), 0) != 1
    ORDER BY job.id
    LIMIT 1
),
discarded_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'discarded'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
        AND job.id < (SELECT first_pending.id FROM first_pending)
        AND COALESCE(json_extract(job.metadata, '$.seq_continue_discarded'), 0) != 1
    ORDER BY job.id
    LIMIT 1
),
retryable_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'retryable'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
    ORDER BY job.id
    LIMIT 1
),
running_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'running'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
    ORDER BY job.id
    LIMIT 1
),
scheduled_blocker AS (
    SELECT job.id, job.kind, job.queue, job.state, job.scheduled_at
    FROM /* TEMPLATE: schema */river_job AS job
    WHERE job.state = 'scheduled'
        AND json_type(job.metadata, '$.seq_key') IS NOT NULL
        AND json_extract(job.metadata, '$.seq_key') = (SELECT seq_key FROM target)
    ORDER BY job.id
    LIMIT 1
),
blockers AS (
    SELECT * FROM available_blocker
    UNION ALL
    SELECT * FROM cancelled_blocker
    UNION ALL
    SELECT * FROM discarded_blocker
    UNION ALL
    SELECT * FROM retryable_blocker
    UNION ALL
    SELECT * FROM running_blocker
    UNION ALL
    SELECT * FROM scheduled_blocker
)
SELECT COALESCE((
    SELECT json_object(
        'job_id', target.id,
        'job_state', target.state,
        'key', target.seq_key,
        'first_pending', json((SELECT json_object('id', id, 'kind', kind, 'queue', queue, 'state', state, 'scheduled_at', strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_at)) FROM first_pending)),
        'blockers', json((SELECT json_group_array(json(job)) FROM (SELECT json_object('id', id, 'kind', kind, 'queue', queue, 'state', state, 'scheduled_at', strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_at)) AS job FROM blockers ORDER BY id)))
    )
    FROM target
), 'null') AS sequence;
