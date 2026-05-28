module riverqueue.com/riverui/riverproui

go 1.25.0

toolchain go1.25.7

require (
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.9.2
	github.com/riverqueue/apiframe v0.0.0-20260512144425-bbb398a56fc5
	github.com/riverqueue/river v0.38.0
	github.com/riverqueue/river/riverdriver v0.38.0
	github.com/riverqueue/river/rivershared v0.38.0
	github.com/riverqueue/river/rivertype v0.38.0
	github.com/stretchr/testify v1.11.1
	riverqueue.com/riverpro v0.24.0
	riverqueue.com/riverpro/driver v0.24.0
	riverqueue.com/riverpro/driver/riverpropgxv5 v0.24.0
	riverqueue.com/riverui v0.16.0
)

require (
	cel.dev/expr v0.25.1 // indirect
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.13 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.2 // indirect
	github.com/google/cel-go v0.27.0 // indirect
	github.com/jackc/pgerrcode v0.0.0-20250907135507-afb5586c32a6 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/riverqueue/river/riverdriver/riverpgxv5 v0.38.0 // indirect
	github.com/rs/cors v1.11.1 // indirect
	github.com/samber/slog-http v1.12.1 // indirect
	github.com/tidwall/gjson v1.19.0 // indirect
	github.com/tidwall/match v1.2.0 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	go.opentelemetry.io/otel v1.29.0 // indirect
	go.opentelemetry.io/otel/trace v1.29.0 // indirect
	go.uber.org/goleak v1.3.0 // indirect
	golang.org/x/crypto v0.51.0 // indirect
	golang.org/x/exp v0.0.0-20240823005443-9b4947da3948 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.44.0 // indirect
	golang.org/x/text v0.37.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260226221140-a57be14db171 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260217215200-42d3e9bedb6d // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

retract (
	v0.12.1 // Improper release process, not fully usable
	v0.12.0 // Improper release process, not fully usable
)

// replace riverqueue.com/riverpro => ../../riverpro

// replace riverqueue.com/riverpro/driver => ../../riverpro/driver

// replace riverqueue.com/riverpro/driver/riverpropgxv5 => ../../riverpro/driver/riverpropgxv5

// replace riverqueue.com/riverui => ../
