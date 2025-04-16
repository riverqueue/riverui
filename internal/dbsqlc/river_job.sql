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

CREATE TABLE river_job(
    id bigserial PRIMARY KEY,
    args jsonb NOT NULL DEFAULT '{}',
    attempt smallint NOT NULL DEFAULT 0,
    attempted_at timestamptz,
    attempted_by text[],
    created_at timestamptz NOT NULL DEFAULT NOW(),
    errors jsonb[],
    finalized_at timestamptz,
    kind text NOT NULL,
    max_attempts smallint NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    priority smallint NOT NULL DEFAULT 1,
    queue text NOT NULL DEFAULT 'default',
    state river_job_state NOT NULL DEFAULT 'available',
    scheduled_at timestamptz NOT NULL DEFAULT NOW(),
    tags varchar(255)[] NOT NULL DEFAULT '{}',
    unique_key bytea,
    unique_states bit(8),
    CONSTRAINT finalized_or_finalized_at_null CHECK (
        (finalized_at IS NULL AND state NOT IN ('cancelled', 'completed', 'discarded')) OR
        (finalized_at IS NOT NULL AND state IN ('cancelled', 'completed', 'discarded'))
    ),
    CONSTRAINT priority_in_range CHECK (priority >= 1 AND priority <= 4),
    CONSTRAINT queue_length CHECK (char_length(queue) > 0 AND char_length(queue) < 128),
    CONSTRAINT kind_length CHECK (char_length(kind) > 0 AND char_length(kind) < 128)
);

-- name: JobKindListByPrefix :many
SELECT DISTINCT ON (kind) kind
FROM river_job
WHERE (@prefix = '' OR kind ILIKE @prefix || '%')
    AND (@after = '' OR kind > @after)
ORDER BY kind ASC
LIMIT @max;
