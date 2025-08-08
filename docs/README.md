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
River UI exposes two types of health checks:
1. `minimal`: Will succeed if the server can return a response regardless of the database connection.
2. `complete`: Will succeed if the database connection is working.

For production deployments, it is recommended to use the `complete` health check.

### How to use
#### HTTP Endpoint
Useful when running on Kubernetes or behind load balancer that can hit the HTTP endpoint.

The URL would be `{prefix}/api/health-checks/{name}`

- `{prefix}` is the path prefix set in the environment variable `PATH_PREFIX` or `-prefix` flag
- `{name}` is the health check name. Can be `minimal` or `complete`.}`

**Example:** When setting `PATH_PREFIX=/my-prefix` and wanting to include the database connection in the health check the path would be
`/my-prefix/api/health-checks/complete`

#### CLI Flag
Useful when running under something like AWS ECS where it cannot query the HTTP endpoint natively.

The CLI flag will query the HTTP endpoint internally and return the result.

This keeps the image small since we don't rely on an http client like `curl`

**Example:** When using a prefix like `/my-prefix` and wanting to include the database connection in the health check the command would be
`riverui -prefix=/my-prefix -healthcheck=complete`

When setting this command in ECS tasks for healtechecks it would something like this:
```json
{
  "containerDefinitions": [
    {
      "name": "riverui",
      "image": "ghcr.io/riverqueue/riverui:latest",
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD",
          "/bin/riverui",
          "-prefix=/my-prefix",
          "-healthcheck=complete"
        ]
      }
    }
  ]
}
```


## Configuration

### Custom path prefix

The `riverui` command accepts a `-prefix` arg to set a path prefix on both the API and static assets. When executing the Docker image, this is accepted as a `PATH_PREFIX` env.

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
