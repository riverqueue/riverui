package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
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

// viteManifestPath is where Vite writes the bundle's manifest, relative to a
// module's root. The handler reads it to find the entry script and styles.
const viteManifestPath = "dist/.vite/manifest.json"

func createBundle() error {
	var (
		check           bool
		dir             string
		latestFromList  string
		mod             string
		outputDirPath   string
		requireFrontend bool
		timestampInt    int64
		versionString   string
	)
	flag.BoolVar(&check, "check", false, "only check that dir's module zip would include nothing but Go source, module files, docs, and embedded frontend files")
	flag.StringVar(&dir, "dir", "", "dir to package up")
	flag.StringVar(&latestFromList, "latest-from-list", "", "only print the version that Go's @latest query selects from the version list in this file, one version per line: the highest release version, or the highest prerelease if there's no release version")
	flag.StringVar(&mod, "mod", "", "module name, i.e. github.com/user/repo")
	flag.Int64Var(&timestampInt, "timestamp", 0, "timestamp of the version")
	flag.BoolVar(&requireFrontend, "require-frontend", false, "fail unless dir's module zip would include the built frontend: dist/index.html, the Vite manifest, every file the manifest references, and the static files in public")
	flag.StringVar(&outputDirPath, "output", "", "output directory path, which will include a fully nested directory structure for the module name")
	flag.StringVar(&versionString, "version", "", "version of the module")

	flag.Parse()

	if latestFromList != "" {
		return printLatestVersion(os.Stdout, latestFromList)
	}

	if dir == "" {
		return errors.New("dir is required")
	}

	if err := checkModuleFiles(dir, requireFrontend); err != nil {
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

// checkFrontendFiles fails unless includedFiles, the slash-separated paths a
// module zip in dir would include, holds the built frontend that the handler
// serves: dist/index.html, the Vite manifest, every file the manifest
// references, and at least one static file in public. A module can compile
// without these, so the check catches a release that would fail at runtime.
func checkFrontendFiles(dir string, includedFiles map[string]struct{}) error {
	var violations []error
	requireFile := func(relPath, reason string) {
		if _, ok := includedFiles[relPath]; !ok {
			violations = append(violations, fmt.Errorf("%s: module zip would not include %s, %s", dir, relPath, reason))
		}
	}

	requireFile("dist/index.html", "the frontend's entry page")
	requireFile(viteManifestPath, "the Vite manifest")

	var includesPublicFile bool
	for relPath := range includedFiles {
		if strings.HasPrefix(relPath, "public/") {
			includesPublicFile = true
			break
		}
	}
	if !includesPublicFile {
		violations = append(violations, fmt.Errorf("%s: module zip would not include any static files in public", dir))
	}

	if _, ok := includedFiles[viteManifestPath]; ok {
		manifestFiles, err := viteManifestFiles(filepath.Join(dir, filepath.FromSlash(viteManifestPath)))
		if err != nil {
			return err
		}
		if len(manifestFiles) == 0 {
			violations = append(violations, fmt.Errorf("%s: %s references no files", dir, viteManifestPath))
		}
		for _, manifestFile := range manifestFiles {
			requireFile(path.Join("dist", manifestFile), "which "+viteManifestPath+" references")
		}
	}

	return errors.Join(violations...)
}

// checkModuleFiles fails if the module zip of the module in dir would include
// a path that allowedPath rejects or, with requireFrontend, would leave out
// part of the built frontend. It selects files with the same rules as the
// module zip itself.
func checkModuleFiles(dir string, requireFrontend bool) error {
	files, err := zip.CheckDir(dir)
	if err != nil {
		return fmt.Errorf("error checking module files in %s: %w", dir, err)
	}

	var (
		includedFiles = make(map[string]struct{}, len(files.Valid))
		violations    []error
	)
	for _, filePath := range files.Valid {
		relPath, err := filepath.Rel(dir, filePath)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)
		includedFiles[relPath] = struct{}{}
		if !allowedPath(relPath) {
			violations = append(violations, fmt.Errorf("%s: module zip would include %s", dir, relPath))
		}
	}
	if requireFrontend {
		if err := checkFrontendFiles(dir, includedFiles); err != nil {
			violations = append(violations, err)
		}
	}
	if len(violations) == 0 {
		fmt.Printf("%s: %d files\n", dir, len(files.Valid))
	}
	return errors.Join(violations...)
}

// viteManifestFiles returns every file, relative to the bundle's root, that
// the Vite manifest at manifestPath references: each chunk's file and its CSS
// and other assets.
func viteManifestFiles(manifestPath string) ([]string, error) {
	contents, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("error reading Vite manifest: %w", err)
	}

	var manifest map[string]struct {
		Assets []string `json:"assets"`
		CSS    []string `json:"css"`
		File   string   `json:"file"`
	}
	if err := json.Unmarshal(contents, &manifest); err != nil {
		return nil, fmt.Errorf("error parsing Vite manifest %s: %w", manifestPath, err)
	}

	var files []string
	for _, chunk := range manifest {
		if chunk.File != "" {
			files = append(files, chunk.File)
		}
		files = append(files, chunk.CSS...)
		files = append(files, chunk.Assets...)
	}
	slices.Sort(files)
	return slices.Compact(files), nil
}

type Info struct {
	Version string    `json:"Version"` //nolint:tagliatelle
	Time    time.Time `json:"Time"`    //nolint:tagliatelle
}
