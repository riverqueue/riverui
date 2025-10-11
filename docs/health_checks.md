# River UI Health Checks
River UI exposes two types of health checks:
1. `minimal`: Will succeed if the server can return a response regardless of the database connection.
2. `complete`: Will succeed if the database connection is working.

For production deployments, it is recommended to use the `complete` health check.

## How to use
### HTTP Endpoint
Useful when running on Kubernetes or behind load balancer that can hit the HTTP endpoint.

The URL would be `{prefix}/api/health-checks/{name}`

- `{prefix}` is the path prefix set in the environment variable `PATH_PREFIX` or `-prefix` flag
- `{name}` is the health check name. Can be `minimal` or `complete`.

**Example:** When setting `PATH_PREFIX=/my-prefix` and wanting to include the database connection in the health check the path would be
```text
/my-prefix/api/health-checks/complete
```

### CLI Flag
The riverui binary provides `-healthcheck=<minimal|complete>` flag. This flag allows the binary to perform a health check as a command.

This useful when the container orchestrator cannot hit the health check endpoint natively. Like in AWS ECS Tasks or Docker Compose file.

The CLI flag will query the HTTP endpoint internally and exit based on the response.

This keeps the container image small without having to install additional dependencies.

**Example:** When using a prefix like `/my-prefix` and wanting to include the database connection in the health check the command would be
```text
/bin/riverui -prefix=/my-prefix -healthcheck=complete
```

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

### Silencing request logs for health checks

If you run the bundled `riverui` server and want to reduce log noise from frequent health probes, use the `-silent-healthchecks` flag. This will configure the HTTP logging middleware to skip logs for health endpoints under the configured prefix.

```text
/bin/riverui -prefix=/my-prefix -silent-healthchecks
```

If you embed the UI in your own server, you can apply a similar filter to your logging middleware. For example with `slog-http`:

```go
// assuming prefix has been normalized (e.g., "/my-prefix")
apiHealthPrefix := strings.TrimSuffix(prefix, "/") + "/api/health-checks"
logHandler := sloghttp.NewWithConfig(logger, sloghttp.Config{
    Filters:     []sloghttp.Filter{sloghttp.IgnorePathPrefix(apiHealthPrefix)},
    WithSpanID:  otelEnabled,
    WithTraceID: otelEnabled,
})
```
