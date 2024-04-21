module github.com/riverqueue/riverui

go 1.22

require (
	github.com/jackc/pgx/v5 v5.5.5
	github.com/riverqueue/river v0.3.0
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.3.0
	github.com/riverqueue/river/rivertype v0.3.0
	github.com/rs/cors v1.10.0
)

require (
	github.com/google/uuid v1.6.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20231201235250-de7065d80cb9 // indirect
	github.com/jackc/puddle/v2 v2.2.1 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/riverqueue/river/riverdriver v0.3.0 // indirect
	github.com/samber/slog-http v1.0.0 // indirect
	go.opentelemetry.io/otel v1.19.0 // indirect
	go.opentelemetry.io/otel/trace v1.19.0 // indirect
	golang.org/x/crypto v0.22.0 // indirect
	golang.org/x/sync v0.7.0 // indirect
	golang.org/x/text v0.14.0 // indirect
)

// replace github.com/riverqueue/river => ../river

// replace github.com/riverqueue/river/riverdriver => ../river/riverdriver

// replace github.com/riverqueue/river/rivertype => ../river/rivertype

// replace github.com/riverqueue/river/riverdriver/riverpgxv5 => ../river/riverdriver/riverpgxv5
