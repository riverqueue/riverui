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

# Definitions of following tasks look ugly, but they're done this way because to
# produce the best/most comprehensible output by far (e.g. compared to a shell
# loop).
.PHONY: lint
lint:: ## Run linter (golangci-lint) for all submodules
define lint-target
    lint:: ; cd $1 && golangci-lint run --fix
endef
$(foreach mod,$(submodules),$(eval $(call lint-target,$(mod))))

.PHONY: test
test:: ## Run test suite for all submodules
define test-target
    test:: ; cd $1 && go test ./... -timeout 2m
endef
$(foreach mod,$(submodules),$(eval $(call test-target,$(mod))))

.PHONY: test/race
test/race:: ## Run test suite for all submodules with race detector
define test-race-target
    test/race:: ; cd $1 && go test ./... -race -timeout 2m
endef
$(foreach mod,$(submodules),$(eval $(call test-race-target,$(mod))))

.PHONY: tidy
tidy:: ## Run `go mod tidy` for all submodules
define tidy-target
    tidy:: ; cd $1 && go mod tidy
endef
$(foreach mod,$(submodules),$(eval $(call tidy-target,$(mod))))

.PHONY: update-river
update-river:: ## Update version of River dependencies to latest
define update-river-target
update-river:: ; cd $1 && \
	go get -u github.com/riverqueue/river@latest \
		github.com/riverqueue/river/riverdriver@latest \
		github.com/riverqueue/river/riverdriver/riverpgxv5@latest \
		github.com/riverqueue/river/rivershared@latest \
		github.com/riverqueue/river/rivertype@latest \
		$2 && \
	go mod tidy
endef
$(eval $(call update-river-target,.))
$(eval $(call update-river-target,./riverproui, \
	github.com/riverqueue/river/riverdriver/riversqlite@latest \
	riverqueue.com/riverpro@latest \
	riverqueue.com/riverpro/driver@latest \
	riverqueue.com/riverpro/driver/riverpropgxv5@latest \
	riverqueue.com/riverpro/driver/riverprosqlite@latest))

preview: build
	npm run preview

.PHONY: verify
verify:
verify: verify/sqlc

.PHONY: verify/sqlc
verify/sqlc:
	cd internal/dbsqlc && sqlc diff
