package riverui_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"riverqueue.com/riverui"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/util/slogutil"
)

// ExampleNewServer demonstrates how to create a River UI server,
// embed it in an HTTP server, and make requests to its API endpoints.
func ExampleNewServer() {
	ctx := context.Background()

	// Create a PostgreSQL connection pool. In a real application, you'd use your
	// own connection string or pool config.
	connConfig, err := pgxpool.ParseConfig(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		panic(err)
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, connConfig)
	if err != nil {
		panic(err)
	}
	defer dbPool.Close()

	// Create a River client with a message-only logger for reproducible output.
	// You can use any slog.Handler implementation in your application.
	logger := slog.New(&slogutil.SlogMessageOnlyHandler{Level: slog.LevelWarn})

	// Create a River client. We don't need to start the client since we're only
	// using it to demonstrate the UI.
	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{
		Logger: logger,
	})
	if err != nil {
		panic(err)
	}

	// Create the River UI server. This server implements http.Handler and can be
	// mounted in an HTTP mux
	server, err := riverui.NewServer(&riverui.ServerOpts{
		Client:  client,
		DevMode: true, // Use the live filesystem—don't use this outside tests
		DB:      dbPool,
		Logger:  logger,
		Prefix:  "/riverui", // Mount the UI under /riverui path
	})
	if err != nil {
		panic(err)
	}

	// Start the server to initialize background processes
	// This does not start an HTTP server
	if err := server.Start(ctx); err != nil {
		panic(err)
	}

	// Create an HTTP mux and mount the River UI:
	mux := http.NewServeMux()
	mux.Handle("/riverui/", server)

	// For this example, we use a test server to demonstrate API calls. In a
	// production environment, you would use http.ListenAndServe instead.
	testServer := httptest.NewServer(mux)
	defer testServer.Close()

	// Make a request to the jobs endpoint to demonstrate API usage:
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, testServer.URL+"/riverui/api/jobs?state=available", nil)
	if err != nil {
		panic(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	fmt.Printf("Status: %s\n", resp.Status)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Response: %s\n", strings.TrimSpace(string(body)))

	// Output:
	// Status: 200 OK
	// Response: {"data":[]}
}
