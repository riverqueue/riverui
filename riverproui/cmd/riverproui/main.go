package main

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver/riverpropgxv5"

	"riverqueue.com/riverui/internal/riveruicmd"
	"riverqueue.com/riverui/riverproui"
	"riverqueue.com/riverui/uiendpoints"
)

func main() {
	riveruicmd.Run(
		func(dbPool *pgxpool.Pool, schema string) (*riverpro.Client[pgx.Tx], error) {
			return riverpro.NewClient(riverpropgxv5.New(dbPool), &riverpro.Config{Schema: schema})
		},
		func(client *riverpro.Client[pgx.Tx]) uiendpoints.Bundle {
			return riverproui.NewEndpoints(client, nil)
		},
	)
}
