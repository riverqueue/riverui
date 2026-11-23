package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/mod/module"
	"golang.org/x/mod/semver"
	"golang.org/x/mod/zip"
)

func main() {
	if err := createBundle(); err != nil {
		log.Fatal(err)
	}
}

// allowedFilePattern matches the only files, relative to a module's root,
// that a module zip may include: non-test Go source, module files, license,
// changelog, and readme files, and the built frontend bundle and static files
// that Go embeds. Anything else, like CI configuration or frontend sources,
// fails the check so that a new kind of file fails the release instead of
// shipping.
var allowedFilePattern = regexp.MustCompile(`^(.+\.go|go\.(mod|sum)|(.+/)?README\.md|CHANGELOG\.md|LICENSE|dist/.+|public/.+)$`)

// disallowedPathPattern matches paths, relative to a module's root, that must
// never be published even when allowedFilePattern matches them: test files,
// source maps, fixture and testdata directories, and trees that only exist to
// build, test, or document River UI. remove-unpackaged-files.sh removes them
// before packaging.
var disallowedPathPattern = regexp.MustCompile(`_test\.go$|\.map$|(^|/)(fixtures?|testdata)/|^(docs|node_modules|packager|scripts|src)/`)

// dotDirectoryPattern matches paths under a directory whose name starts with a
// dot, like `.github` or `.cursor`.
var dotDirectoryPattern = regexp.MustCompile(`(^|/)\.[^/]*/`)

func createBundle() error {
	var (
		check         bool
		dir           string
		mod           string
		outputDirPath string
		timestampInt  int64
		versionString string
	)
	flag.BoolVar(&check, "check", false, "only check that dir's module zip would include nothing but Go source, module files, docs, and embedded frontend files")
	flag.StringVar(&dir, "dir", "", "dir to package up")
	flag.StringVar(&mod, "mod", "", "module name, i.e. github.com/user/repo")
	flag.Int64Var(&timestampInt, "timestamp", 0, "timestamp of the version")
	flag.StringVar(&outputDirPath, "output", "", "output directory path, which will include a fully nested directory structure for the module name")
	flag.StringVar(&versionString, "version", "", "version of the module")

	flag.Parse()

	if dir == "" {
		return errors.New("dir is required")
	}

	if err := checkModuleFiles(dir); err != nil {
		return err
	}
	if check {
		return nil
	}

	if outputDirPath == "" {
		return errors.New("output is required")
	}
	if mod == "" {
		return errors.New("mod is required")
	}
	if timestampInt == 0 {
		return errors.New("timestamp is required")
	}
	if versionString == "" {
		return errors.New("version is required")
	}

	if !semver.IsValid(versionString) {
		return errors.New("version is not valid")
	}

	// Convert the timestamp to a time.Time object:
	timestamp := time.Unix(timestampInt, 0).UTC()

	nestedOutputDir := filepath.Join(outputDirPath, mod)
	vOutputDir := filepath.Join(nestedOutputDir, "@v")

	if err := os.MkdirAll(vOutputDir, 0o700); err != nil {
		return err
	}
	outputRoot, err := os.OpenRoot(vOutputDir)
	if err != nil {
		return err
	}
	defer outputRoot.Close()

	version := module.Version{
		Path:    mod,
		Version: versionString,
	}

	modFilename := version.Version + ".mod"
	zipFilename := version.Version + ".zip"
	infoFilename := version.Version + ".info"

	modFileContents, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return err
	}

	if err := outputRoot.WriteFile(modFilename, modFileContents, 0o600); err != nil {
		return err
	}

	f, err := outputRoot.OpenFile(zipFilename, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	if err := zip.CreateFromDir(f, version, dir); err != nil {
		return err
	}

	info := Info{
		Version: version.Version,
		Time:    timestamp,
	}

	infoFile, err := outputRoot.Create(infoFilename)
	if err != nil {
		return err
	}
	defer infoFile.Close()

	if err := json.NewEncoder(infoFile).Encode(info); err != nil {
		return err
	}

	return nil
}

// allowedPath reports whether a module zip may include relPath, a
// slash-separated path relative to the module's root.
func allowedPath(relPath string) bool {
	if !allowedFilePattern.MatchString(relPath) || disallowedPathPattern.MatchString(relPath) {
		return false
	}

	// Vite writes the bundle's manifest to `dist/.vite`, the only dot
	// directory a module zip may include.
	return strings.HasPrefix(relPath, "dist/") || !dotDirectoryPattern.MatchString(relPath)
}

// checkModuleFiles fails if the module zip of the module in dir would include
// a path that allowedPath rejects. It selects files with the same rules as the
// module zip itself.
func checkModuleFiles(dir string) error {
	files, err := zip.CheckDir(dir)
	if err != nil {
		return fmt.Errorf("error checking module files in %s: %w", dir, err)
	}

	var violations []error
	for _, path := range files.Valid {
		relPath, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)
		if !allowedPath(relPath) {
			violations = append(violations, fmt.Errorf("%s: module zip would include %s", dir, relPath))
		}
	}
	if len(violations) == 0 {
		fmt.Printf("%s: %d files\n", dir, len(files.Valid))
	}
	return errors.Join(violations...)
}

type Info struct {
	Version string    `json:"Version"` //nolint:tagliatelle
	Time    time.Time `json:"Time"`    //nolint:tagliatelle
}
