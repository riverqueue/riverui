#!/bin/sh
#
# Packages the riverui version that riverproui requires, if it isn't published
# yet, into a directory that Go can use as a module proxy ahead of the real
# ones:
#
#     GOPROXY="file://$dir,$GOPROXY"
#
# Usage, from the checkout's root:
#
#     packager/build-candidate-proxy.sh <dir> [<command> [<arg>...]]
#
# riverui and riverproui release from one commit, so riverproui's go.sum holds
# the hash of a riverui version that's published only after that commit is
# tagged. Module zips are reproducible, so building the frontend and packaging
# riverui from an export of the tracked files, as the release workflow does,
# gives the zip that the release will publish.
#
# A version that's already published is skipped, because its published zip is
# the one that counts. On an ordinary commit it is, and this only asks
# riverui's own module proxy about it. GOPROXY's public mirror isn't asked,
# because it would remember for a while that a version about to be released
# doesn't exist.
#
# A command, like `go build ./...`, runs afterward in riverproui with the
# candidate proxy first in GOPROXY. If anything was packaged, it gets a
# throwaway module cache: the candidate zip must not stay in the regular cache
# under a release version number, and a previous run's zip must not stand in
# for this run's. Otherwise it uses the regular cache, so an ordinary commit
# downloads nothing new.

set -eu

if [ $# -lt 1 ]; then
	echo "usage: $0 <dir> [<command> [<arg>...]]" >&2
	exit 1
fi

mkdir -p "$1"
proxy_dir="$(cd "$1" && pwd)"
shift
root="$(pwd)"

run() {
	[ $# -eq 0 ] || (cd "$root/riverproui" && GOPROXY="file://$proxy_dir,$(go env GOPROXY)" "$@")
}

# A previous run's zip must not stand in for this run's.
rm -rf "$proxy_dir/riverqueue.com"

version="$(awk '$1 == "riverqueue.com/riverui" { print $2 }' riverproui/go.mod)"

# Run outside the repository's modules. GOPROXY=direct asks the proxy that
# riverqueue.com names for the module.
if (cd "$proxy_dir" && GOPROXY=direct GOSUMDB=off go list -m "riverqueue.com/riverui@$version" >/dev/null 2>&1); then
	echo "riverqueue.com/riverui@$version is published"
	run "$@"
	exit 0
fi

# Include uncommitted changes to tracked files, so this works before the
# release commit exists. `git stash create` prints nothing when there are
# none, and fails when the index is only stale, like after `go mod edit`.
tree="$(git stash create || true)"
tree="${tree:-HEAD}"

export_dir="$(mktemp -d)"
modcache="$(mktemp -d)"
trap 'rm -rf "$export_dir" "$modcache"' EXIT
git archive "$tree" | tar -x -C "$export_dir"

# Build the frontend as the release workflow does. Vite reads NODE_ENV and
# VITE_ variables from the environment, which would change the bundle.
(
	cd "$export_dir"
	unset NODE_ENV $(env | sed -n 's/^\(VITE_[A-Za-z0-9_]*\)=.*/\1/p')
	npm ci
	npm exec vite build -- --sourcemap false
	./packager/remove-unpackaged-files.sh
)

echo "packaging riverqueue.com/riverui@$version"
(cd packager && go run . \
	-dir "$export_dir" \
	-mod riverqueue.com/riverui \
	-output "$proxy_dir" \
	-require-frontend \
	-timestamp "$(git log -1 --format=%ct "$tree")" \
	-version "$version")

# The checksum database doesn't have the unpublished version either.
export GOMODCACHE="$modcache" GOFLAGS=-modcacherw GONOSUMDB="riverqueue.com/riverui,$(go env GONOSUMDB)"
run "$@"
