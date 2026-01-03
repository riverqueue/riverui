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

1. Fetch changes to the repo and any new tags. Export `VERSION` by incrementing the last tag:

   ```shell
   git checkout master && git pull --rebase
   export VERSION=v0.x.y
   git checkout -b $USER-$VERSION
   ```

2. Prepare a PR with the changes, updating `CHANGELOG.md` with any necessary additions at the same time. Have it reviewed and merged.

3. Upon merge, pull down the changes, tag the main riverui module with the new version, and push the new tag:

   ```shell
   git pull origin master
   git tag $VERSION
   git push --tags
   ```

4. The build will cut a new release and create binaries automatically, but it won't have a good release message. Go the [release list](https://github.com/riverqueue/riverui/releases), find `$VERSION` and change the description to the release content in `CHANGELOG.md` (again, the build will have to finish first).

### Releasing riverproui

The `riverproui` submodule depends on the top level `riverui` module and in development it is customary to leave a `replace` directive in its `go.mod` so that it can be developed against the live local version. However, this `replace` directive makes it incompatible with `go install ...@latest`.

As such, we must use a two-phase release for these modules:

1. Release `riverui` with an initial version (i.e. all the steps above).

2. Comment out `replace` directives to riverui `./riverproui/go.mod`. These were probably needed for developing the new feature, but need to be removed because they prevent the module from being `go install`-able.

3. From `./riverproui`, `go get` to upgrade to the main package versions were just released (make sure you're getting `$VERSION` and not thwarted by shenanigans in Go's module proxy):

   ```shell
   cd ./riverproui
   go get -u riverqueue.com/riverui@$VERSION
   ```

4. Run `go mod tidy`:

   ```shell
   go mod tidy
   ```

5. Prepare a PR with the changes. Have it reviewed and merged.

6. Pull the changes back down, add a tag for `riverproui/$VERSION`, and push it to GitHub:

   ```shell
   git pull origin master
   git tag riverproui/$VERSION -m "release riverproui/$VERSION"
   git push --tags
   ```

   The main `$VERSION` tag and `riverproui/$VERSION` will point to different commits, and although a little odd, is tolerable.
