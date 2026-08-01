# syntax=docker/dockerfile:1

FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5 AS build-ui
WORKDIR /app
COPY .npmrc package.json package-lock.json ./
RUN npm ci
ENV NODE_ENV=production
COPY vite.config.ts tsconfig.json tsconfig.node.json tsr.config.json ./
COPY public ./public
COPY src ./src

RUN npx vite build

# Build the Go binary, including embedded UI files:
FROM golang:1.25.12-alpine@sha256:56961d79ea8129efddcc0b8643fd8a5416b4e6228cfd477e3fd61deb2672c587 AS build-go
WORKDIR /go/src/riverui

COPY go.mod go.sum ./
RUN go mod download

# Copy Go files without copying the ui dir:
COPY *.go internal docs/README.md LICENSE ./
COPY cmd/ cmd/
COPY internal/ internal/
COPY public/ public/
COPY uiendpoints/ uiendpoints/

COPY --from=build-ui /app/dist ./dist

RUN go build -trimpath -ldflags="-w -s -buildid=" -o /bin/riverui ./cmd/riverui

FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/sh", "-c", "/bin/riverui -prefix=$PATH_PREFIX"]
