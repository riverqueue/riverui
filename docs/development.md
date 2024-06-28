# River UI development

River UI consists of two apps: a Go backend API, and a TypeScript UI frontend.

## Migrate database

```sh
cp .env.sample .env
```

```sh
$ createdb river-development
$ go install github.com/riverqueue/river/cmd/river
$ river migrate-up --database-url postgres://localhost/river-development
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
$ createdb river-test
$ river migrate-up --database-url postgres://localhost/river-test
```

Run tests:

```sh
$ go test ./...
```

## TypeScript UI

The UI lives in the `ui/` subdirectory. Go to it and install dependencies:

```sh
$ cd ui
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