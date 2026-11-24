# River UI development

River UI consists of two apps: a Go backend API, and a TypeScript UI frontend.

## Environment

The project uses a combination of direnv and dotenv (to suit Vite conventions). Copy the example and edit as necessary:

```sh
cp .envrc.sample .envrc
direnv allow
```

Direnv's `.envrc` sources dotenv's `.env.local` to make all variables available in your shell, along with a `.env` if it exists. Both `.env` and `.env.local` get read by `npm run dev`.

## Install dependencies

```sh
go get ./...
npm install
```

This project uses [Reflex](https://github.com/cespare/reflex) for local dev. Install it.

``` sh
go install github.com/cespare/reflex@latest
```

## Running the UI and API together

```sh
make dev
```

By default the Go backend starts at http://localhost:8080 and the Vite React frontend starts at http://localhost:5173.

## Migrate database

```sh
$ createdb river_dev
$ go install github.com/riverqueue/river/cmd/river
$ river migrate-up --database-url postgres://localhost/river_dev
```

## Postgres with Docker Compose 
Using Docker compose, you can skip the database migration steps for testing and development.

The database will be bound to `localhost:5432`.
```sh
# start/restart
make docker-db/up

# stop
make docker-db/down
```

## Run tests

Raise test database:

```sh
$ createdb river_test
$ river migrate-up --database-url postgres://localhost/river_test
```

Run tests:

```sh
$ go test ./...
```

## Building

Alternatively, build the TypeScript API to `dist`, which will be included in the Go API's bundle during compilation, if it's present:

```sh
$ npm run build
```

## Releasing a new version

The `riverui` module and the `riverproui` submodule release from one commit. In that commit `riverproui`'s `go.mod` requires the `riverui` version being released, and its `go.sum` holds the hash of a `riverui` zip that's published only once the commit is tagged. Module zips are reproducible, so `make release/prepare` builds the frontend and packages `riverui` locally the way the release workflow does, and writes the hash from that zip. CI packages `riverui` again from the pull request's commit and downloads `riverproui`'s dependencies through it, so a `go.sum` that doesn't match fails with a `checksum mismatch`. `make release/verify` makes the same check locally.

Building the frontend needs the Node.js version that `package.json` requires.

1. Fetch changes to the repo and any new tags. Export `VERSION` by incrementing the last tag, and start a branch:

   ```shell
   git checkout master && git pull --rebase
   export VERSION=v0.x.y
   git checkout -b $USER-$VERSION
   ```

2. Update `CHANGELOG.md`. Make sure the `replace` directive for `riverui` in `./riverproui/go.mod` is commented out, because it prevents `riverproui` from being `go install`-able. Then set `riverproui`'s `riverui` requirement to `$VERSION` and write its `go.sum`:

   ```shell
   make release/prepare
   ```

   The `riverui` zip includes `CHANGELOG.md`, so run this after editing the changelog, and again after any later change to `riverui`'s Go code, frontend, or changelog. Until `$VERSION` is published, `go mod tidy` in `./riverproui` (and `make tidy`) can't find it.

3. Prepare a PR with the changes. Have it reviewed and merged. If changes to `riverui` merge to `master` after the PR's CI ran, its result is out of date, so wait for CI on `master` before tagging.

4. Upon merge, pull down the changes, check `riverproui`'s `go.sum` against the merged commit, then tag both modules and push the tags:

   ```shell
   git pull origin master
   make release/verify
   git tag $VERSION
   git tag riverproui/$VERSION -m "release riverproui/$VERSION"
   git push origin $VERSION riverproui/$VERSION
   ```

   Run `make release/verify` with no uncommitted changes to tracked files, because it packages them too. If it fails with a `checksum mismatch`, `riverui` changed after `make release/prepare`: don't tag, and rerun `make release/prepare` with the same version in a new PR.

5. The build will cut a new release and create binaries automatically, but it won't have a good release message. Go the [release list](https://github.com/riverqueue/riverui/releases), find `$VERSION` and change the description to the release content in `CHANGELOG.md` (again, the build will have to finish first).
