// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.27.0
// source: workflow.sql

package dbsqlc

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

const workflowListActive = `-- name: WorkflowListActive :many
WITH workflow_ids AS (
    SELECT DISTINCT ON (workflow_id) metadata->>'workflow_id' AS workflow_id
    FROM river_job
    WHERE state IN ('available', 'pending', 'retryable', 'running', 'scheduled')
        AND metadata ? 'workflow_id'
        AND metadata->>'workflow_id' > $1::text
    ORDER BY workflow_id DESC
    LIMIT $2::integer
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
ORDER BY river_job.metadata->>'workflow_id' DESC
`

type WorkflowListActiveParams struct {
	After           string
	PaginationLimit int32
}

type WorkflowListActiveRow struct {
	WorkflowID        string
	WorkflowName      string
	EarliestCreatedAt pgtype.Timestamptz
	CountFailedDeps   int64
	CountAvailable    int64
	CountCancelled    int64
	CountCompleted    int64
	CountDiscarded    int64
	CountPending      int64
	CountRetryable    int64
	CountRunning      int64
	CountScheduled    int64
}

func (q *Queries) WorkflowListActive(ctx context.Context, db DBTX, arg *WorkflowListActiveParams) ([]*WorkflowListActiveRow, error) {
	rows, err := db.Query(ctx, workflowListActive, arg.After, arg.PaginationLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*WorkflowListActiveRow
	for rows.Next() {
		var i WorkflowListActiveRow
		if err := rows.Scan(
			&i.WorkflowID,
			&i.WorkflowName,
			&i.EarliestCreatedAt,
			&i.CountFailedDeps,
			&i.CountAvailable,
			&i.CountCancelled,
			&i.CountCompleted,
			&i.CountDiscarded,
			&i.CountPending,
			&i.CountRetryable,
			&i.CountRunning,
			&i.CountScheduled,
		); err != nil {
			return nil, err
		}
		items = append(items, &i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const workflowListAll = `-- name: WorkflowListAll :many
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
    AND river_job.metadata->>'workflow_id' > $1::text
GROUP BY river_job.metadata->>'workflow_id', metadata->>'workflow_name'
ORDER BY river_job.metadata->>'workflow_id' DESC
LIMIT $2::integer
`

type WorkflowListAllParams struct {
	After           string
	PaginationLimit int32
}

type WorkflowListAllRow struct {
	WorkflowID        string
	WorkflowName      string
	EarliestCreatedAt pgtype.Timestamptz
	CountFailedDeps   int64
	CountAvailable    int64
	CountCancelled    int64
	CountCompleted    int64
	CountDiscarded    int64
	CountPending      int64
	CountRetryable    int64
	CountRunning      int64
	CountScheduled    int64
}

func (q *Queries) WorkflowListAll(ctx context.Context, db DBTX, arg *WorkflowListAllParams) ([]*WorkflowListAllRow, error) {
	rows, err := db.Query(ctx, workflowListAll, arg.After, arg.PaginationLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*WorkflowListAllRow
	for rows.Next() {
		var i WorkflowListAllRow
		if err := rows.Scan(
			&i.WorkflowID,
			&i.WorkflowName,
			&i.EarliestCreatedAt,
			&i.CountFailedDeps,
			&i.CountAvailable,
			&i.CountCancelled,
			&i.CountCompleted,
			&i.CountDiscarded,
			&i.CountPending,
			&i.CountRetryable,
			&i.CountRunning,
			&i.CountScheduled,
		); err != nil {
			return nil, err
		}
		items = append(items, &i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const workflowListInactive = `-- name: WorkflowListInactive :many
WITH active_workflow_ids AS (
    SELECT DISTINCT ON (workflow_id) metadata->>'workflow_id' AS workflow_id
    FROM river_job
    WHERE state IN ('available', 'pending', 'retryable', 'running', 'scheduled')
        AND metadata->>'workflow_id' > $2::text
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
LIMIT $1::integer
`

type WorkflowListInactiveParams struct {
	PaginationLimit int32
	After           string
}

type WorkflowListInactiveRow struct {
	WorkflowID        string
	WorkflowName      string
	EarliestCreatedAt pgtype.Timestamptz
	CountFailedDeps   int64
	CountAvailable    int64
	CountCancelled    int64
	CountCompleted    int64
	CountDiscarded    int64
	CountPending      int64
	CountRetryable    int64
	CountRunning      int64
	CountScheduled    int64
}

func (q *Queries) WorkflowListInactive(ctx context.Context, db DBTX, arg *WorkflowListInactiveParams) ([]*WorkflowListInactiveRow, error) {
	rows, err := db.Query(ctx, workflowListInactive, arg.PaginationLimit, arg.After)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*WorkflowListInactiveRow
	for rows.Next() {
		var i WorkflowListInactiveRow
		if err := rows.Scan(
			&i.WorkflowID,
			&i.WorkflowName,
			&i.EarliestCreatedAt,
			&i.CountFailedDeps,
			&i.CountAvailable,
			&i.CountCancelled,
			&i.CountCompleted,
			&i.CountDiscarded,
			&i.CountPending,
			&i.CountRetryable,
			&i.CountRunning,
			&i.CountScheduled,
		); err != nil {
			return nil, err
		}
		items = append(items, &i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
