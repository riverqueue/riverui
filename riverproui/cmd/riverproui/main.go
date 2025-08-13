package main

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"riverqueue.com/riverpro"
	"riverqueue.com/riverpro/driver/riverpropgxv5"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riveruicmd"
	"riverqueue.com/riverui/riverproui"
)

func main() {
	riveruicmd.Run(
		func(dbPool *pgxpool.Pool) (*riverpro.Client[pgx.Tx], error) {
			return riverpro.NewClient(riverpropgxv5.New(dbPool), &riverpro.Config{})
		},
		func(client *riverpro.Client[pgx.Tx]) apibundle.EndpointBundle {
			return riverproui.NewEndpoints(client, nil)
		},
	)
}
