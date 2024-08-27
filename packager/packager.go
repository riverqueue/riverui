package main

import (
	"encoding/json"
	"errors"
	"flag"
	"log"
	"os"
	"path/filepath"
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

func createBundle() error {
	var (
		dir           string
		mod           string
		outputDirPath string
		timestampInt  int64
		versionString string
	)
	flag.StringVar(&dir, "dir", "", "dir to package up")
	flag.StringVar(&mod, "mod", "", "module name, i.e. github.com/user/repo")
	flag.Int64Var(&timestampInt, "timestamp", 0, "timestamp of the version")
	flag.StringVar(&outputDirPath, "output", "", "output directory path, which will include a fully nested directory structure for the module name")
	flag.StringVar(&versionString, "version", "", "version of the module")

	flag.Parse()

	if dir == "" {
		return errors.New("dir is required")
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

	version := module.Version{
		Path:    mod,
		Version: versionString,
	}

	modFilename := version.Version + ".mod"
	zipFilename := version.Version + ".zip"

	modFileContents, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(vOutputDir, modFilename), modFileContents, 0o644); err != nil {
		return err
	}

	f, err := os.OpenFile(filepath.Join(vOutputDir, zipFilename), os.O_CREATE|os.O_WRONLY, 0o644)
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

	infoFile, err := os.Create(filepath.Join(vOutputDir, version.Version+".info"))
	if err != nil {
		return err
	}
	defer infoFile.Close()

	if err := json.NewEncoder(infoFile).Encode(info); err != nil {
		return err
	}

	return nil
}

type Info struct {
	Version string    // version string
	Time    time.Time // commit time
}
