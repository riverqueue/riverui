-- name: IndexesExistInCurrentSchema :many
WITH index_names AS (
    SELECT unnest(@index_names::text[]) as index_name
)
SELECT index_names.index_name::text,
       EXISTS (
         SELECT 1
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = current_schema()
         AND c.relname = index_names.index_name
         AND c.relkind = 'i'
       ) AS exists
FROM index_names;

-- name: IndexExistsInCurrentSchema :one
SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
    AND c.relname = @index_name::text
    AND c.relkind = 'i'
);

-- name: TableExistsInCurrentSchema :one
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
    AND table_name = @table_name::text
);
