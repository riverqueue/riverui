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
FROM golang:1.25.10-alpine@sha256:8d22e29d960bc50cd025d93d5b7c7d220b1ee9aa7a239b3c8f55a57e987e8d45 AS build-go
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

FROM alpine:3.23.4@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/sh", "-c", "/bin/riverui -prefix=$PATH_PREFIX"]
