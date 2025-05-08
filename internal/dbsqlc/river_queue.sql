CREATE TABLE river_queue(
  name text PRIMARY KEY NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL
);

-- name: QueueNameListByPrefix :many
SELECT name
FROM river_queue
WHERE name > @after::text
  AND (@prefix::text = '' OR name LIKE @prefix::text || '%')
  AND (@exclude::text[] IS NULL OR name != ALL(@exclude))
ORDER BY name
LIMIT @max::int;

