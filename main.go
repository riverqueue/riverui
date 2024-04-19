package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/riverui/internal/db"
)

func main() {
	ctx := context.Background()

	dbPool, err := getDBPool(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer dbPool.Close()

	corsHandler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: []string{"http://localhost:5173"},
	})

	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
	if err != nil {
		log.Fatal(err)
	}
	handler := &apiHandler{client: client, dbPool: dbPool, queries: db.New(dbPool)}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/jobs", handler.JobList)
	mux.HandleFunc("POST /api/jobs/cancel", handler.JobCancel)
	mux.HandleFunc("POST /api/jobs/retry", handler.JobRetry)
	mux.HandleFunc("GET /api/jobs/{id}", handler.JobGet)
	mux.HandleFunc("GET /api/queues", handler.QueueList)
	mux.HandleFunc("GET /api/queues/{name}", handler.QueueGet)
	mux.HandleFunc("PUT /api/queues/{name}/pause", handler.QueuePause)
	mux.HandleFunc("PUT /api/queues/{name}/resume", handler.QueueResume)
	mux.HandleFunc("GET /api/workflows/{id}", handler.WorkflowGet)
	mux.HandleFunc("GET /api/states", handler.StatesAndCounts)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: corsHandler.Handler(mux),
	}

	log.Printf("starting server on %s", srv.Addr)

	err = srv.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func getDBPool(ctx context.Context) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig("postgres://postgres:postgres@localhost:5432/riverdemo_dev")
	if err != nil {
		return nil, fmt.Errorf("error parsing db config: %w", err)
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("error connecting to db: %w", err)
	}
	return dbPool, nil
}
