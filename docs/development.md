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

3. Upon merge, pull down the changes, tag each module with the new version, and push the new tags:

   ```shell
   git pull origin master
   git tag $VERSION
   git push --tags
   ```

4. The build will cut a new release and create binaries automatically, but it won't have a good release message. Go the [release list](https://github.com/riverqueue/riverui/releases), find `$VERSION` and change the description to the release content in `CHANGELOG.md` (again, the build will have to finish first).
