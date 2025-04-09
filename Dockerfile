# syntax=docker/dockerfile:1

FROM node:22-alpine AS build-ui
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
ENV NODE_ENV=production
COPY . .

RUN npx vite build

# Build the Go binary, including embedded UI files:
FROM golang:1.23-alpine AS build-go
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
ENV PATH_PREFIX="/"
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/sh", "-c", "/bin/riverui -prefix=$PATH_PREFIX"]
