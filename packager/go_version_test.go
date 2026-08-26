package main

import (
	goversion "go/version"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/mod/modfile"
)

func TestGoVersionCompatibleWithRiverUI(t *testing.T) {
	t.Parallel()

	var (
		packagerGoVersion = goVersionFromModFile(t, "go.mod")
		riverUIGoVersion  = goVersionFromModFile(t, filepath.Join("..", "go.mod"))
	)

	if goversion.Compare("go"+packagerGoVersion, "go"+riverUIGoVersion) < 0 {
		t.Fatalf("packager Go version %s must be at least River UI Go version %s", packagerGoVersion, riverUIGoVersion)
	}
}

func goVersionFromModFile(t *testing.T, path string) string {
	t.Helper()

	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("error reading %s: %v", path, err)
	}

	parsed, err := modfile.Parse(path, contents, nil)
	if err != nil {
		t.Fatalf("error parsing %s: %v", path, err)
	}
	if parsed.Go == nil {
		t.Fatalf("%s has no Go version", path)
	}

	return parsed.Go.Version
}
