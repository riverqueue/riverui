CREATE UNLOGGED TABLE river_producer (
    id bigserial PRIMARY KEY,
    client_id text NOT NULL,
    queue_name text NOT NULL,

    max_workers int NOT NULL CHECK (max_workers >= 0),
    metadata jsonb NOT NULL DEFAULT '{}',
    paused_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- name: ProducerListByQueue :many
SELECT
    sqlc.embed(river_producer),
    COALESCE(
        (
            SELECT SUM((value->>'count')::int)
            FROM jsonb_each(metadata->'concurrency'->'running')
        ),
        0
    )::int as running
FROM river_producer
WHERE queue_name = @queue_name
ORDER BY id ASC;
