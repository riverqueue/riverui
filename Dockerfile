# syntax=docker/dockerfile:1
FROM node:20-alpine AS build-ui
WORKDIR /app
COPY ui/package.json ui/package-lock.json ./
RUN npm install
ENV NODE_ENV=production
COPY ui/ .
ARG VITE_RIVER_API_BASE_URL
RUN npm exec vite build

# Build the Go binary, including embedded UI files:
FROM golang:1.22.2-alpine AS build-go
WORKDIR /go/src/riverui

COPY go.mod go.sum ./
RUN go mod download

# Copy Go files without copying the ui dir:
COPY *.go ./
COPY internal/ internal/
COPY ui/*.go ./ui/
COPY --from=build-ui /app/dist ./ui/dist

RUN go build -o /bin/riverui .

FROM alpine:3.19.1
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/riverui"]
