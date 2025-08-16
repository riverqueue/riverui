# syntax=docker/dockerfile:1

FROM node:22-alpine AS build-ui
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
ENV NODE_ENV=production
COPY vite.config.ts tsconfig.json tsconfig.node.json tsr.config.json ./
COPY public ./public
COPY src ./src

RUN npx vite build

# Build the Go binary, including embedded UI files:
FROM golang:1.24-alpine AS build-go
WORKDIR /go/src/riverui

# Download main module dependencies first
COPY go.mod go.sum ./
RUN go mod download

# Download riverproui module dependencies with secret
COPY riverproui/go.mod riverproui/go.sum ./riverproui/
WORKDIR /go/src/riverui/riverproui
RUN --mount=type=secret,id=riverpro_credential,dst=/etc/secrets/riverpro_credential \
  sh -c 'GOPROXY=https://proxy.golang.org,https://u:$(cat /etc/secrets/riverpro_credential)@riverqueue.com/goproxy,direct \
  go mod download'

# Return to main directory and copy Go files without copying the ui dir:
WORKDIR /go/src/riverui
COPY *.go internal docs/README.md LICENSE ./
COPY cmd/ cmd/
COPY internal/ internal/
COPY public/ public/
COPY uiendpoints/ uiendpoints/

COPY riverproui/ riverproui/

COPY --from=build-ui /app/dist ./dist

# Build the riverproui binary
WORKDIR /go/src/riverui/riverproui
RUN go build -trimpath -ldflags="-w -s -buildid=" -o /bin/riverproui ./cmd/riverproui

FROM alpine:3.22.1
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverproui /bin/riverproui
CMD ["/bin/sh", "-c", "/bin/riverproui -prefix=$PATH_PREFIX"]
