package main

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/riveruicmd"
	"riverqueue.com/riverui/uiendpoints"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

func main() {
	riveruicmd.Run(
		func(dbPool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
			return river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
		},
		func(client *river.Client[pgx.Tx]) uiendpoints.Bundle {
			return riverui.NewEndpoints(client, nil)
		},
	)
}
