.PHONY: generate
generate:
generate: generate/sqlc

.PHONY: generate/sqlc
generate/sqlc:
	cd internal/dbsqlc && sqlc generate

.PHONY: lint
lint:
	cd . && golangci-lint run --fix

.PHONY: test
test:
	cd . && go test ./...

.PHONY: verify
verify:
verify: verify/sqlc

.PHONY: verify/sqlc
verify/sqlc:
	cd internal/dbsqlc && sqlc diff
