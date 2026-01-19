# River UI [![Go Reference](https://pkg.go.dev/badge/riverqueue.com/riverui.svg)](https://pkg.go.dev/riverqueue.com/riverui)

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

## Health Checks
See [health checks](health_checks.md).

## Configuration

### Custom path prefix

Serve River UI under a URL prefix like `/ui` by setting `-prefix` (binary) or `PATH_PREFIX` (Docker). Rules: **must start with `/`**, use `/` for no prefix, and a trailing `/` is ignored.

Example: `./riverui -prefix=/ui` serves the UI at `/ui/` and the API at `/ui/api/...` (and `/ui` will redirect to `/ui/`).

Reverse proxies: either preserve the prefix and set `-prefix=/ui`, or strip the prefix and leave `-prefix=/` (don’t do both).

### Hiding job list arguments by default

The `RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT` environment variable controls whether, by default, the job list UI shows job arguments. By default job arguments are always shown. If `RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT=true` or `RIVER_JOB_LIST_HIDE_ARGS_BY_DEFAULT=1` is set, job args will not be shown in the job list by default.

Individual users may still override this preference using the settings screen in the UI. A user's saved preference takes precedence over any default setting.

### HTTP Authentication

The `riverui` supports HTTP basic authentication to protect access to the UI.
To enable it, set the `RIVER_BASIC_AUTH_USER` and `RIVER_BASIC_AUTH_PASS` environment variables.

Alternatively, if embedding River UI into another Go app, you can wrap its `http.Handler` with any custom authentication logic.

### Logging Configuration

The `riverui` command utilizes the `RIVER_LOG_LEVEL` environment variable to configure its logging level. The following values are accepted:

* `debug`
* `info` (default)
* `warn`
* `error`

By default logs are written with the [`slog.TextHandler`](https://pkg.go.dev/log/slog#TextHandler) `key=value` format. For JSON output with [`slog.JSONHandler`](https://pkg.go.dev/log/slog#JSONHandler), set `RIVER_LOG_FORMAT=json`.

## Development

See [developing River UI](./development.md).
