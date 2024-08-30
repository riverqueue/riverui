# River UI

River UI is a graphical user interface for the [River job queue](https://github.com/riverqueue/river). It lets users view and manage jobs without having to resort to querying the database or the command line.

A [live demo of River UI](https://ui.riverqueue.com) is available to see what it looks like.

## Installation

A working River database is required for the UI to start up properly. See [running River migrations](https://riverqueue.com/docs/migrations), and make sure a `DATABASE_URL` is exported to env.

```sh
$ go install github.com/riverqueue/river/cmd/river@latest
$ river migrate-up --database-url "$DATABASE_URL"
```

### From binary

River UI [releases](https://github.com/riverqueue/riverui/releases) include a set of static binaries for a variety of architectures and operating systems. Use one of these links:

* [Linux AMD64](https://github.com/riverqueue/riverui/releases/latest/download/riverui_linux_amd64.gz)
* [Linux ARM64](https://github.com/riverqueue/riverui/releases/latest/download/riverui_linux_arm64.gz)
* [macOS AMD64](https://github.com/riverqueue/riverui/releases/latest/download/riverui_darwin_amd64.gz)
* [macOS ARM64](https://github.com/riverqueue/riverui/releases/latest/download/riverui_darwin_arm64.gz)

Or fetch a binary with cURL:

```sh
$ RIVER_ARCH=arm64 # either 'amd64' or 'arm64'
$ RIVER_OS=darwin  # either 'darwin' or 'linux'
$ curl -L https://github.com/riverqueue/riverui/releases/latest/download/riverui_${RIVER_OS}_${RIVER_ARCH}.gz | gzip -d > riverui
$ chmod +x riverui
$ export DATABASE_URL=...
$ ./riverui
```

### From container image

River UI ships [container images](https://github.com/riverqueue/riverui/pkgs/container/riverui) with each release. Pull and run the latest with:

```sh
$ docker pull ghcr.io/riverqueue/riverui:latest
$ docker run -p 8080:8080 --env DATABASE_URL ghcr.io/riverqueue/riverui:latest
```

### Custom path prefix

The `riverui` command accepts a `-prefix` arg to set a path prefix on both the API and static assets. When executing the Docker image, this is accepted as a `PATH_PREFIX` env.

## Development

See [developing River UI](./development.md).
