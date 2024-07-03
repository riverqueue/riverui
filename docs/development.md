# River UI development

River UI consists of two apps: a Go backend API, and a TypeScript UI frontend.

## Migrate database

```sh
cp .env.example .env
```

```sh
$ createdb river_dev
$ go install github.com/riverqueue/river/cmd/river
$ river migrate-up --database-url postgres://localhost/river_dev
```

## Go API

```sh
go build ./cmd/riverui && ./riverui
```

By default it starts at http://localhost:8080.

The API will need a build TypeScript UI in `ui/dist`, or you'll have to serve it separately (see below).

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

## TypeScript UI

The UI lives in the `ui/` subdirectory. Go to it, copy an `.env` file, and install dependencies:

```sh
$ cd ui
$ cp .env.sample .env
$ npm install
```

Run the development server:

```sh
$ npm run dev
```

By default it starts at http://localhost:5173 and tries to reach the API on 8080.

Alternatively, build the TypeScript API to `ui/dist`, which will be included in the Go API's bundle during compilation, if it's present:

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

4. The build will cut a new release and create binaries automatically, but it won't have a good release message. Go the [release list](https://github.com/riverqueue/river/releases), find `$VERSION` and change the description to the release content in `CHANGELOG.md` (again, the build will have to finish first).
