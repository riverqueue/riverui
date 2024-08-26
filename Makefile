.PHONY: clean
clean:
	@rm -rf dist
	@go clean -i

.PHONY: dev
dev: fake_assets
	npm run dev

.PHONY: fake_assets
fake_assets:
	@echo 'Skipping asset build'
	@mkdir -p dist
	@echo "assets build was skipped" > dist/index.html

.PHONY: dist
dist:
	@npm run build

.PHONY: build
build: dist
	CGO_ENABLED=0 go build

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

preview: build
	npm run preview

.PHONY: verify
verify:
verify: verify/sqlc

.PHONY: verify/sqlc
verify/sqlc:
	cd internal/dbsqlc && sqlc diff
