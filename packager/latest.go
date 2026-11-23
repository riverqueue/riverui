package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/mod/module"
	"golang.org/x/mod/semver"
)

// latestVersion returns the version that Go's `@latest` query selects from
// versions, a module's version list: the highest release version or, only when
// the list has no release version, the highest prerelease. It ignores
// pseudo-versions, as the go command does when it reads a proxy's version
// list, and entries that aren't canonical semantic versions like `v1` or
// `v1.2.3+meta`, which a module zip can't be published under.
func latestVersion(versions []string) (string, error) {
	var latestPrerelease, latestRelease string
	for _, version := range versions {
		if !semver.IsValid(version) || semver.Canonical(version) != version || module.IsPseudoVersion(version) {
			continue
		}

		if semver.Prerelease(version) == "" {
			if latestRelease == "" || semver.Compare(version, latestRelease) > 0 {
				latestRelease = version
			}
		} else if latestPrerelease == "" || semver.Compare(version, latestPrerelease) > 0 {
			latestPrerelease = version
		}
	}

	switch {
	case latestRelease != "":
		return latestRelease, nil
	case latestPrerelease != "":
		return latestPrerelease, nil
	default:
		return "", errors.New("version list has no valid versions")
	}
}

// printLatestVersion writes the version that latestVersion selects from the
// version list at listPath, which holds one version per line like a module
// proxy's `@v/list`, to w.
func printLatestVersion(w io.Writer, listPath string) error {
	contents, err := os.ReadFile(listPath)
	if err != nil {
		return err
	}

	latest, err := latestVersion(strings.Fields(string(contents)))
	if err != nil {
		return fmt.Errorf("%s: %w", listPath, err)
	}

	_, err = fmt.Fprintln(w, latest)
	return err
}
