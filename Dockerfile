# syntax=docker/dockerfile:1

# PATH_PREFIX for configuring the frontend's path prefix
ARG PATH_PREFIX="/"

FROM node:20-alpine AS build-ui
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
ENV NODE_ENV=production
COPY . .
ARG PATH_PREFIX
# The URL (potentially relative) of the riverui API server to use. Defaults to
# /api if unset:
ARG VITE_RIVER_API_BASE_URL

RUN CLEAN_PATH_PREFIX=$(echo $PATH_PREFIX | sed 's:/$::') && \
  VITE_RIVER_API_BASE_URL=${VITE_RIVER_API_BASE_URL:-${CLEAN_PATH_PREFIX}/api} && \
  export VITE_RIVER_API_BASE_URL && \
  npx vite build --base=${PATH_PREFIX}

# Build the Go binary, including embedded UI files:
FROM golang:1.22-alpine AS build-go
WORKDIR /go/src/riverui

COPY go.mod go.sum ./
RUN go mod download

# Copy Go files without copying the ui dir:
COPY *.go internal docs/README.md LICENSE ./
COPY cmd/ cmd/
COPY internal/ internal/
COPY public/ public/
COPY --from=build-ui /app/dist ./dist

RUN go build -o /bin/riverui ./cmd/riverui

FROM alpine:3.19.1

ARG PATH_PREFIX
ENV PATH_PREFIX=${PATH_PREFIX}
COPY --from=build-go /bin/riverui /bin/riverui
CMD /bin/riverui -prefix=$PATH_PREFIX
