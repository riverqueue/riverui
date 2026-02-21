module riverqueue.com/riverui/riverproui

go 1.25.0

toolchain go1.25.7

require (
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.8.0
	github.com/riverqueue/apiframe v0.0.0-20251229202423-2b52ce1c482e
	github.com/riverqueue/river v0.31.0
	github.com/riverqueue/river/riverdriver v0.31.0
	github.com/riverqueue/river/rivershared v0.31.0
	github.com/riverqueue/river/rivertype v0.31.0
	github.com/stretchr/testify v1.11.1
	riverqueue.com/riverpro v0.22.0
	riverqueue.com/riverpro/driver v0.22.0
	riverqueue.com/riverpro/driver/riverpropgxv5 v0.22.0
	riverqueue.com/riverui v0.14.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.12 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.1 // indirect
	github.com/jackc/pgerrcode v0.0.0-20250907135507-afb5586c32a6 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.31.0 // indirect
	github.com/rs/cors v1.11.1 // indirect
	github.com/samber/slog-http v1.12.0 // indirect
	github.com/tidwall/gjson v1.18.0 // indirect
	github.com/tidwall/match v1.2.0 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	go.opentelemetry.io/otel v1.29.0 // indirect
	go.opentelemetry.io/otel/trace v1.29.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	golang.org/x/crypto v0.46.0 // indirect
	golang.org/x/sync v0.19.0 // indirect
	golang.org/x/sys v0.39.0 // indirect
	golang.org/x/text v0.34.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

retract (
	v0.12.1 // Improper release process, not fully usable
	v0.12.0 // Improper release process, not fully usable
)

// replace riverqueue.com/riverui => ../

// replace riverqueue.com/riverpro => ../../riverpro

// replace riverqueue.com/riverpro/driver => ../../riverpro/driver

// replace riverqueue.com/riverpro/driver/riverpropgxv5 => ../../riverpro/driver/riverpropgxv5
