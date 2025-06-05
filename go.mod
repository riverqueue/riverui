module riverqueue.com/riverui

go 1.23.0

toolchain go1.24.1

require (
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.5
	github.com/riverqueue/apiframe v0.0.0-20250408034821-b206bbbd0fb4
	github.com/riverqueue/river v0.23.1
	github.com/riverqueue/river/riverdriver v0.23.1
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.23.1
	github.com/riverqueue/river/rivershared v0.23.1
	github.com/riverqueue/river/rivertype v0.23.1
	github.com/rs/cors v1.11.1
	github.com/samber/slog-http v1.7.0
	github.com/stretchr/testify v1.10.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.8 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.25.0 // indirect
	github.com/jackc/pgerrcode v0.0.0-20240316143900-6e2875d9b438 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/tidwall/gjson v1.18.0 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	go.opentelemetry.io/otel v1.29.0 // indirect
	go.opentelemetry.io/otel/trace v1.29.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	golang.org/x/crypto v0.38.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sync v0.14.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/text v0.25.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

// replace github.com/riverqueue/river => ../river

// replace github.com/riverqueue/river/riverdriver => ../river/riverdriver

// replace github.com/riverqueue/river/rivertype => ../river/rivertype

// replace github.com/riverqueue/river/riverdriver/riverpgxv5 => ../river/riverdriver/riverpgxv5
