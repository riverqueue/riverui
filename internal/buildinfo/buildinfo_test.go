package buildinfo

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGet(t *testing.T) {
	t.Parallel()

	info := Get()

	require.NotNil(t, info)
	require.Equal(t, runtime.Version(), info.GoVersion)
	// `go test` builds the test binary from the module, so the module path
	// is always embedded; version may be "(devel)" when unbuilt from a tag.
	require.NotEmpty(t, info.Version)
}
