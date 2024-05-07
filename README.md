# River UI

River UI consists of two apps: a Go backend API, and a TypeScript UI frontend.

## Local Development

From the root directory, run `go build` to build the `riverui` executable. You'll need to copy the `.env.example` to `.env` and customize as needed to configure it.

```sh
go build && ./riverui
```

By default it runs on port 8080, though this can be customized via the `PORT` env.

If the JS frontend has been built for distribution (within the `ui/dist` dir), it will be served by the Go executable. Otherwise, you can run the JS frontend separately via `npm run dev` in the `ui` directory. By default the UI runs on port 5173 at `http://localhost:5173/` and connects to the API at port 8080, though this can also be customized in the UI's `.env` file.
