package main

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/riveruicmd"
	"riverqueue.com/riverui/uiendpoints"
)

func main() {
	riveruicmd.Run(
		func(dbPool *pgxpool.Pool, schema string) (*river.Client[pgx.Tx], error) {
			return river.NewClient(riverpgxv5.New(dbPool), &river.Config{Schema: schema})
		},
		func(client *river.Client[pgx.Tx]) uiendpoints.Bundle {
			return riverui.NewEndpoints(client, nil)
		},
	)
}
