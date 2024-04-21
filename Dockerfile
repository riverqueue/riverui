# syntax=docker/dockerfile:1
FROM node:20-alpine AS build-ui
WORKDIR /app
COPY ui/package.json ui/package-lock.json ./
RUN npm install
ENV NODE_ENV=production
COPY ui/ .
RUN npm run build

# Build the Go binary, including embedded UI files:
FROM golang:1.22.2-alpine AS build-go
WORKDIR /go/src/riverui

COPY go.mod go.sum ./
RUN go mod download

# Copy Go files without copying the ui dir:
COPY *.go ./
COPY internal/ internal/
RUN ls -la 
COPY ui/*.go ./ui/
COPY --from=build-ui /app/dist ./ui/dist

RUN go build -o /bin/riverui .

FROM alpine:3.19.1
COPY --from=build-go /bin/riverui /bin/riverui
CMD ["/bin/riverui"]
