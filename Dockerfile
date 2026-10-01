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
FROM golang:1.26.7-alpine@sha256:28d89ee9cc0ff9fec75c82ca201e6bf7fdf9a679d4b7b24dfa04f2bb766bb468 AS build-go
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

# Pass metadata from the original checkout; this partial copy is not a Git checkout.
ARG BUILD_VERSION
ARG BUILD_REVISION
ARG BUILD_COMMIT_TIME

RUN go build -trimpath -ldflags="-w -s -buildid= -X riverqueue.com/riverui/internal/buildinfo.version=${BUILD_VERSION} -X riverqueue.com/riverui/internal/buildinfo.revision=${BUILD_REVISION} -X riverqueue.com/riverui/internal/buildinfo.commitTime=${BUILD_COMMIT_TIME}" -o /bin/riverui ./cmd/riverui

FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/sh", "-c", "/bin/riverui -prefix=$PATH_PREFIX"]
