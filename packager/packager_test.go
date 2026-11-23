package main

import "testing"

func TestAllowedPath(t *testing.T) {
	t.Parallel()

	t.Run("AllowsModuleContents", func(t *testing.T) {
		t.Parallel()

		for _, relPath := range []string{
			"CHANGELOG.md",
			"LICENSE",
			"cmd/riverui/main.go",
			"dist/.vite/manifest.json",
			"dist/assets/main-CCviwrLn.js",
			"dist/index.html",
			"go.mod",
			"go.sum",
			"handler.go",
			"internal/riveruidriver/riveruipostgres/internal/dbsqlc/river_job.sql.go",
			"public/index.html",
		} {
			if !allowedPath(relPath) {
				t.Errorf("expected %s to be allowed", relPath)
			}
		}
	})

	t.Run("RejectsDisallowedDirectories", func(t *testing.T) {
		t.Parallel()

		for _, relPath := range []string{
			".github/workflows/ci.go",
			"docs/example.go",
			"internal/.cache/tool.go",
			"internal/testdata/handler.go",
			"node_modules/pkg/main.go",
			"packager/packager.go",
			"scripts/ci/tool.go",
			"src/main.go",
		} {
			if allowedPath(relPath) {
				t.Errorf("expected %s to be rejected", relPath)
			}
		}
	})

	t.Run("RejectsSourceMaps", func(t *testing.T) {
		t.Parallel()

		if allowedPath("dist/assets/main-CCviwrLn.js.map") {
			t.Error("expected source map to be rejected")
		}
	})

	t.Run("RejectsTestFiles", func(t *testing.T) {
		t.Parallel()

		for _, relPath := range []string{
			"handler_test.go",
			"riverproui/pro_handler_test.go",
		} {
			if allowedPath(relPath) {
				t.Errorf("expected %s to be rejected", relPath)
			}
		}
	})

	t.Run("RejectsToolingAndOtherFiles", func(t *testing.T) {
		t.Parallel()

		for _, relPath := range []string{
			".cursor/rules/testing-practices.mdc",
			".dockerignore",
			".env.local",
			".envrc.sample",
			".golangci.yaml",
			".npmrc",
			".reflex.server",
			"AGENTS.md",
			"Dockerfile",
			"Makefile",
			"docker-compose.dev.yaml",
			"internal/riveruidriver/riveruipostgres/internal/dbsqlc/river_job.sql",
			"internal/riveruidriver/riveruipostgres/internal/dbsqlc/sqlc.yaml",
			"package.json",
			"scripts/ci/prefetch-referrers-content.sh",
			"tsr.config.json",
			"vitest.config.ts",
		} {
			if allowedPath(relPath) {
				t.Errorf("expected %s to be rejected", relPath)
			}
		}
	})
}
