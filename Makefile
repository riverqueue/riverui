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
