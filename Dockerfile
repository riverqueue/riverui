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
FROM golang:1.25.6-alpine AS build-go
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

FROM alpine:3.23.2
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/sh", "-c", "/bin/riverui -prefix=$PATH_PREFIX"]
