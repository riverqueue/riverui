.PHONY: clean
clean:
	@rm -rf dist
	@go clean -i

# Find each Go submodule from the top-level directory. Go commands only
# consider the current module, so they must run separately for every module.
submodules := $(shell find . -name 'go\.mod' -exec dirname {} \;)

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

.PHONY: docker-db/up
docker-db/up:
	docker compose -f docker-compose.dev.yaml down
	docker compose -f docker-compose.dev.yaml up

.PHONY: docker-db/down
docker-db/down:
	docker compose -f docker-compose.dev.yaml down

.PHONY: lint
lint:
	cd . && golangci-lint run --fix

.PHONY: test
test:
	cd . && go test ./...
	cd ./riverproui && go test ./...

.PHONY: tidy
tidy:: ## Run `go mod tidy` for all submodules
define tidy-target
    tidy:: ; cd $1 && go mod tidy
endef
$(foreach mod,$(submodules),$(eval $(call tidy-target,$(mod))))

preview: build
	npm run preview

.PHONY: verify
verify:
verify: verify/sqlc

.PHONY: verify/sqlc
verify/sqlc:
	cd internal/dbsqlc && sqlc diff
