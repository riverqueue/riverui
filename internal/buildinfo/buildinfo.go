// Package buildinfo reports build and version information for the running
// binary, sourced from Go's embedded build metadata with optional overrides
// injected at link time:
//
//	go build -ldflags "-X riverqueue.com/riverui/internal/buildinfo.version=v1.2.3 ..."
package buildinfo

import (
	"runtime"
	"runtime/debug"
)

// The variables below may be set at link time with -ldflags -X to override
// the values Go embeds automatically. They take precedence over the
// corresponding build settings when non-empty.
var (
	version    string
	revision   string //nolint:gochecknoglobals // Set by the Go linker with -X.
	commitTime string //nolint:gochecknoglobals // Set by the Go linker with -X.
)

// Info describes the running binary's build.
type Info struct {
	Version   string
	Revision  string
	Time      string
	Modified  bool
	GoVersion string
}

// Get returns build information for the running binary, preferring link-time
// overrides and falling back to the metadata Go embeds via
// runtime/debug.ReadBuildInfo (module version plus vcs.revision, vcs.time,
// and vcs.modified when built with VCS stamping). Time is the commit time,
// not the time the binary was built. When River UI is embedded, this describes
// the host executable.
func Get() *Info {
	info := &Info{GoVersion: runtime.Version()}

	if version != "" {
		info.Version = version
	}
	if revision != "" {
		info.Revision = revision
	}
	if commitTime != "" {
		info.Time = commitTime
	}

	if buildInfo, ok := debug.ReadBuildInfo(); ok {
		if info.Version == "" {
			info.Version = buildInfo.Main.Version
		}
		for _, setting := range buildInfo.Settings {
			switch setting.Key {
			case "vcs.revision":
				if info.Revision == "" {
					info.Revision = setting.Value
				}
			case "vcs.time":
				if info.Time == "" {
					info.Time = setting.Value
				}
			case "vcs.modified":
				info.Modified = setting.Value == "true"
			}
		}
	}

	return info
}
