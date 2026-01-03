#!/usr/bin/env bash
set -euo pipefail

# Prefetch referrers for one or more OCI subjects (digests), and warm their blobs.
#
# Required env:
#   - IMAGE_NAME: e.g. "riverqueue.com/riverproui"
#   - AUTH_USER: basic auth username
#   - AUTH_PASSWORD: basic auth password
#   - FORCE_FETCH_SECRET: value for X-Force-Fetch-From-Upstream (best-effort)
#   - REGISTRY_MANIFEST_URL: e.g. "https://riverqueue.com/v2/riverproui/manifests"
#   - REGISTRY_REFERRERS_URL: e.g. "https://riverqueue.com/v2/riverproui/referrers"
#
# Usage:
#   bash scripts/ci/prefetch-referrers-content.sh sha256:... sha256:...

: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${AUTH_USER:?AUTH_USER is required}"
: "${AUTH_PASSWORD:?AUTH_PASSWORD is required}"
: "${FORCE_FETCH_SECRET:?FORCE_FETCH_SECRET is required}"
: "${REGISTRY_MANIFEST_URL:?REGISTRY_MANIFEST_URL is required}"
: "${REGISTRY_REFERRERS_URL:?REGISTRY_REFERRERS_URL is required}"

ACCEPT_MANIFESTS="application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"

force_fetch_manifest_and_referrers() {
  subject="$1"

  # Best-effort: warm the pull-through cache for the subject bytes and its referrers index.
  curl -fsS -u "${AUTH_USER}:${AUTH_PASSWORD}" \
    -H "X-Force-Fetch-From-Upstream: ${FORCE_FETCH_SECRET}" \
    -H "Accept: ${ACCEPT_MANIFESTS}" \
    "${REGISTRY_MANIFEST_URL}/${subject}" -o /dev/null || true

  curl -fsS -u "${AUTH_USER}:${AUTH_PASSWORD}" \
    -H "X-Force-Fetch-From-Upstream: ${FORCE_FETCH_SECRET}" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    "${REGISTRY_REFERRERS_URL}/${subject}" -o /dev/null || true
}

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <subject-digest> [<subject-digest> ...]" >&2
  exit 2
fi

for subject in "$@"; do
  [ -z "$subject" ] && continue

  force_fetch_manifest_and_referrers "$subject"

  # Discover and warm each referrer manifest and its blobs.
  oras discover --format json "${IMAGE_NAME}@${subject}" | tee /tmp/referrers.json
  # ORAS output shape differs by version/flags:
  # - some versions return { "manifests": [...] }
  # - some return { "referrers": [...] }
  digests="$(jq -r '((.manifests // .referrers // []) | .[]? | .digest // empty)' /tmp/referrers.json)"
  for d in $digests; do
    [ -z "$d" ] && continue

    tmpfile="$(mktemp)"
    oras manifest fetch --output "$tmpfile" "${IMAGE_NAME}@${d}"

    cfg="$(jq -r '.config.digest // empty' "$tmpfile")"
    if [ -n "$cfg" ]; then
      oras blob fetch --output /dev/null "${IMAGE_NAME}@${cfg}"
    fi

    jq -r '.layers[]?.digest // empty' "$tmpfile" | while read -r ld; do
      [ -n "$ld" ] && oras blob fetch --output /dev/null "${IMAGE_NAME}@${ld}"
    done
  done
done


