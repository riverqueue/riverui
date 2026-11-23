package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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

func TestCheckModuleFiles(t *testing.T) {
	t.Parallel()

	type testBundle struct {
		dir string
	}

	// setup writes a module with a complete built frontend: an entry page,
	// a Vite manifest, every file the manifest references, and a static file.
	setup := func(t *testing.T) *testBundle {
		t.Helper()

		dir := t.TempDir()
		for relPath, contents := range map[string]string{
			"dist/.vite/manifest.json": `{
				"_vendor-abc.js": {"file": "assets/vendor-abc.js"},
				"src/main.tsx": {
					"assets": ["assets/logo-ghi.svg"],
					"css": ["assets/main-def.css"],
					"file": "assets/main-abc.js",
					"imports": ["_vendor-abc.js"],
					"isEntry": true
				}
			}`,
			"dist/assets/logo-ghi.svg":  "<svg/>",
			"dist/assets/main-abc.js":   "console.log()",
			"dist/assets/main-def.css":  "body{}",
			"dist/assets/vendor-abc.js": "export{}",
			"dist/index.html":           "<html></html>",
			"embed.go":                  "package riverui\n",
			"go.mod":                    "module riverqueue.com/riverui\n",
			"public/index.html":         "<html></html>",
		} {
			writeTestFile(t, filepath.Join(dir, filepath.FromSlash(relPath)), contents)
		}

		return &testBundle{dir: dir}
	}

	requireErrorContains := func(t *testing.T, err error, want string) {
		t.Helper()

		if err == nil {
			t.Fatalf("expected an error containing %q, got none", want)
		}
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("expected an error containing %q, got %v", want, err)
		}
	}

	t.Run("AcceptsCompleteFrontend", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)

		if err := checkModuleFiles(bundle.dir, true); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("AllowsMissingFrontendWhenNotRequired", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		removeTestPath(t, filepath.Join(bundle.dir, "dist"))
		removeTestPath(t, filepath.Join(bundle.dir, "public"))

		if err := checkModuleFiles(bundle.dir, false); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
	})

	t.Run("RejectsDisallowedFile", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		writeTestFile(t, filepath.Join(bundle.dir, ".env.local"), "VITE_RIVER_API_BASE_URL=http://localhost:8080/api\n")

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "module zip would include .env.local")
	})

	t.Run("RejectsManifestReferencingMissingFile", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		removeTestPath(t, filepath.Join(bundle.dir, "dist", "assets", "main-def.css"))

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "would not include dist/assets/main-def.css")
	})

	t.Run("RejectsManifestReferencingNoFiles", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		writeTestFile(t, filepath.Join(bundle.dir, "dist", ".vite", "manifest.json"), "{}")

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "references no files")
	})

	t.Run("RejectsMissingIndex", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		removeTestPath(t, filepath.Join(bundle.dir, "dist", "index.html"))

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "would not include dist/index.html")
	})

	t.Run("RejectsMissingManifest", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		removeTestPath(t, filepath.Join(bundle.dir, "dist", ".vite"))

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "would not include dist/.vite/manifest.json")
	})

	t.Run("RejectsMissingPublicFiles", func(t *testing.T) {
		t.Parallel()

		bundle := setup(t)
		removeTestPath(t, filepath.Join(bundle.dir, "public"))

		requireErrorContains(t, checkModuleFiles(bundle.dir, true), "any static files in public")
	})
}

func removeTestPath(t *testing.T, path string) {
	t.Helper()

	if err := os.RemoveAll(path); err != nil {
		t.Fatalf("error removing %s: %v", path, err)
	}
}

func writeTestFile(t *testing.T, path, contents string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("error creating directory for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("error writing %s: %v", path, err)
	}
}
