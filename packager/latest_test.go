package main

import (
	"bytes"
	"path/filepath"
	"testing"
)

func TestLatestVersion(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name     string
		versions []string
		want     string
	}{
		{
			name:     "HighestRelease",
			versions: []string{"v0.5.0", "v0.12.0", "v0.9.0"},
			want:     "v0.12.0",
		},
		{
			name:     "SkipsNewerPrerelease",
			versions: []string{"v0.15.0", "v0.16.0-rc.1"},
			want:     "v0.15.0",
		},
		{
			name:     "ReleaseAfterItsPrerelease",
			versions: []string{"v0.15.0", "v0.16.0-rc.1", "v0.16.0"},
			want:     "v0.16.0",
		},
		{
			name:     "PrereleaseWhenNoRelease",
			versions: []string{"v0.5.0-pre1", "v0.5.0-pre3", "v0.5.0-pre2"},
			want:     "v0.5.0-pre3",
		},
		{
			name:     "ComparesPrereleasesBySemVer",
			versions: []string{"v1.0.0-rc.10", "v1.0.0-rc.9", "v1.0.0-beta.2"},
			want:     "v1.0.0-rc.10",
		},
		{
			name:     "IgnoresNonCanonicalAndPseudoVersions",
			versions: []string{"v0.1.0", "v9", "v0.3.0+meta", "latest", "v0.2.0-0.20250101000000-abcdefabcdef"},
			want:     "v0.1.0",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := latestVersion(tt.versions)
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %s, got %s", tt.want, got)
			}
		})
	}

	t.Run("RejectsListWithoutValidVersions", func(t *testing.T) {
		t.Parallel()

		for _, versions := range [][]string{nil, {"latest", "1.0.0"}} {
			if _, err := latestVersion(versions); err == nil {
				t.Errorf("expected an error for %v, got none", versions)
			}
		}
	})
}

func TestPrintLatestVersion(t *testing.T) {
	t.Parallel()

	t.Run("ReadsVersionList", func(t *testing.T) {
		t.Parallel()

		listPath := filepath.Join(t.TempDir(), "list")
		writeTestFile(t, listPath, "v0.22.0\nv0.23.0\nv0.24.0-rc.1\n")

		var out bytes.Buffer
		if err := printLatestVersion(&out, listPath); err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if got := out.String(); got != "v0.23.0\n" {
			t.Fatalf("expected v0.23.0, got %q", got)
		}
	})

	t.Run("RejectsEmptyList", func(t *testing.T) {
		t.Parallel()

		listPath := filepath.Join(t.TempDir(), "list")
		writeTestFile(t, listPath, "\n")

		var out bytes.Buffer
		if err := printLatestVersion(&out, listPath); err == nil {
			t.Fatal("expected an error, got none")
		}
	})
}
