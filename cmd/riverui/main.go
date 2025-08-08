package main

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riveruicmd"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

func main() {
	riveruicmd.Run(
		func(dbPool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
			return river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
		},
		func(client *river.Client[pgx.Tx], opts *riveruicmd.BundleOpts) apibundle.EndpointBundle {
			return riverui.NewEndpoints(&riverui.EndpointsOpts[pgx.Tx]{
				Client:                   client,
				JobListHideArgsByDefault: opts.JobListHideArgsByDefault,
			})
		},
	)
}
