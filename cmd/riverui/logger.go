package main

import (
	"log/slog"
	"os"
	"strings"
)

var logger *slog.Logger //nolint:gochecknoglobals

func initLogger() {
	options := &slog.HandlerOptions{Level: getLogLevel()}
	logger = slog.New(slog.NewTextHandler(os.Stdout, options))
}

func getLogLevel() slog.Level {
	if isDebug() {
		return slog.LevelDebug
	}

	env := strings.ToLower(os.Getenv("RIVER_LOG_LEVEL"))

	switch env {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}

	return slog.LevelInfo
}

func isDebug() bool {
	debugEnv := os.Getenv("RIVER_DEBUG")
	return debugEnv == "1" || debugEnv == "true"
}
