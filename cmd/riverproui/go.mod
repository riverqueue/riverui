module github.com/riverqueue/riverui/cmd/riverproui

go 1.24.0

require (
	github.com/riverqueue/river v0.23.2-0.20250707231543-bec698298d0d // indirect
	github.com/riverqueue/river/rivershared v0.23.2-0.20250707231543-bec698298d0d // indirect
	github.com/riverqueue/river/rivertype v0.23.2-0.20250707231543-bec698298d0d // indirect
	riverqueue.com/riverpro v0.15.3
	riverqueue.com/riverpro/driver/riverpropgxv5 v0.15.3
	riverqueue.com/riverui v0.11.0
)

require (
	github.com/jackc/pgx/v5 v5.7.5
	github.com/riverqueue/apiframe v0.0.0-20250708014637-e55c49c01ff7
	github.com/rs/cors v1.11.1
	github.com/samber/slog-http v1.7.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.8 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.27.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jackc/pgerrcode v0.0.0-20240316143900-6e2875d9b438 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/riverqueue/river/riverdriver v0.23.2-0.20250707231543-bec698298d0d // indirect
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.23.2-0.20250707231543-bec698298d0d // indirect
	github.com/stretchr/testify v1.10.0 // indirect
	github.com/tidwall/gjson v1.18.0 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	go.opentelemetry.io/otel v1.29.0 // indirect
	go.opentelemetry.io/otel/trace v1.29.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	golang.org/x/crypto v0.39.0 // indirect
	golang.org/x/net v0.39.0 // indirect
	golang.org/x/sync v0.16.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/text v0.27.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	riverqueue.com/riverpro/driver v0.15.3 // indirect
)

replace github.com/riverqueue/river => ../../../river

replace github.com/riverqueue/river/cmd/river => ../../../river/cmd/river

replace github.com/riverqueue/river/riverdriver => ../../../river/riverdriver

replace github.com/riverqueue/river/riverdriver/riverpgxv5 => ../../../river/riverdriver/riverpgxv5

replace github.com/riverqueue/river/riverpilot => ../../../river/riverpilot

replace github.com/riverqueue/river/rivershared => ../../../river/rivershared

replace github.com/riverqueue/river/rivertype => ../../../river/rivertype

replace riverqueue.com/riverpro => ../../../riverpro

replace riverqueue.com/riverpro/driver => ../../../riverpro/driver

replace riverqueue.com/riverpro/driver/riverprodatabasesql => ../../../riverpro/driver/riverprodatabasesql

replace riverqueue.com/riverpro/driver/riverpropgxv5 => ../../../riverpro/driver/riverpropgxv5

replace riverqueue.com/riverui => ../../../riverui
