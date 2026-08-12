module riverqueue.com/riverui

go 1.25.0

toolchain go1.25.7

require (
	github.com/jackc/pgerrcode v0.0.0-20250907135507-afb5586c32a6
	github.com/jackc/pgx/v5 v5.10.0
	github.com/riverqueue/apiframe v0.0.0-20251229202423-2b52ce1c482e
	github.com/riverqueue/river v0.42.1-0.20260803004224-dc39f530d6db
	github.com/riverqueue/river/riverdriver v0.42.1-0.20260803004224-dc39f530d6db
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.42.1-0.20260803004224-dc39f530d6db
	github.com/riverqueue/river/riverdriver/riversqlite v0.42.1-0.20260803004224-dc39f530d6db
	github.com/riverqueue/river/rivershared v0.42.1-0.20260803004224-dc39f530d6db
	github.com/riverqueue/river/rivertype v0.42.1-0.20260803004224-dc39f530d6db
	github.com/rs/cors v1.11.1
	github.com/samber/slog-http v1.12.1
	github.com/stretchr/testify v1.11.1
	modernc.org/sqlite v1.56.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.12 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mattn/go-isatty v0.0.24 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/tidwall/gjson v1.19.0 // indirect
	github.com/tidwall/match v1.2.0 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	go.opentelemetry.io/otel v1.29.0 // indirect
	go.opentelemetry.io/otel/trace v1.29.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	golang.org/x/crypto v0.52.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	modernc.org/libc v1.74.4 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
)

retract (
	v0.12.1 // Improper release process, not fully usable
	v0.12.0 // Improper release process, not fully usable
)
