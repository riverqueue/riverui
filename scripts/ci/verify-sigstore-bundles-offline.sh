#!/usr/bin/env bash
set -euo pipefail

# Offline verification of Sigstore bundles against exact subject bytes.
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
#   bash scripts/ci/verify-sigstore-bundles-offline.sh sha256:... sha256:... sha256:...
#
# Notes:
# - We "force fetch" the subject + referrers index first to avoid ORAS limitations around custom headers.
# - We retry discovery briefly to avoid eventual-consistency/race flakes in pull-through caches.

: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${AUTH_USER:?AUTH_USER is required}"
: "${AUTH_PASSWORD:?AUTH_PASSWORD is required}"
: "${FORCE_FETCH_SECRET:?FORCE_FETCH_SECRET is required}"
: "${REGISTRY_MANIFEST_URL:?REGISTRY_MANIFEST_URL is required}"
: "${REGISTRY_REFERRERS_URL:?REGISTRY_REFERRERS_URL is required}"

ACCEPT_MANIFESTS="application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json"

echo "oras: $(oras version 2>/dev/null || echo unknown)"
echo "cosign: $(cosign version 2>/dev/null || echo unknown)"
echo "jq: $(jq --version 2>/dev/null || echo unknown)"

force_fetch_manifest_and_referrers() {
  subject="$1"

  curl -fsS -u "${AUTH_USER}:${AUTH_PASSWORD}" \
    -H "X-Force-Fetch-From-Upstream: ${FORCE_FETCH_SECRET}" \
    -H "Accept: ${ACCEPT_MANIFESTS}" \
    "${REGISTRY_MANIFEST_URL}/${subject}" -o /dev/null || true

  curl -fsS -u "${AUTH_USER}:${AUTH_PASSWORD}" \
    -H "X-Force-Fetch-From-Upstream: ${FORCE_FETCH_SECRET}" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    "${REGISTRY_REFERRERS_URL}/${subject}" -o /dev/null || true
}

verify_bundle_for_subject() {
  subject="$1"
  : > /tmp/verify.out

  # Exact subject bytes (do not go through tag indirections).
  oras manifest fetch --output /tmp/subject.json "${IMAGE_NAME}@${subject}"

  bundle_mfs=()
  refjson=""
  for attempt in 1 2 3 4 5; do
    refjson="$(mktemp)"
    force_fetch_manifest_and_referrers "$subject"
    oras discover --format json "${IMAGE_NAME}@${subject}" > "$refjson"

    mapfile -t bundle_mfs < <(jq -r '(.manifests // [])[]
      | select(.artifactType=="application/vnd.dev.sigstore.bundle.v0.3+json"
               or .artifactType=="application/vnd.dev.sigstore.bundle+json;version=0.3")
      | .digest' "$refjson")

    if [ ${#bundle_mfs[@]} -gt 0 ]; then
      break
    fi

    if [ "$attempt" -lt 5 ]; then
      echo "No bundle referrers discovered yet for ${subject} (attempt ${attempt}/5); retrying soon..."
      sleep $((attempt * 2))
    fi
  done

  ok=0
  for bmf in "${bundle_mfs[@]}"; do
    [ -z "$bmf" ] && continue

    mf="$(mktemp)"
    oras manifest fetch --output "$mf" "${IMAGE_NAME}@${bmf}"
    bundle_blob="$(jq -r '.layers[0].digest' "$mf")"
    oras blob fetch --output /tmp/bundle.json "${IMAGE_NAME}@${bundle_blob}"

    if cosign verify-blob-attestation \
      --bundle /tmp/bundle.json \
      --new-bundle-format \
      --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
      --certificate-identity-regexp '^https://github.com/riverqueue/riverui/.*' \
      /tmp/subject.json > /tmp/verify.out 2>&1; then
      echo "Verified OK with bundle ${bmf} for subject ${subject}"
      ok=1
      break
    fi
  done

  if [ "$ok" -ne 1 ]; then
    echo "No matching bundle verified for subject ${subject}"
    if [ ${#bundle_mfs[@]} -eq 0 ]; then
      echo "Note: no bundle referrers were discovered for this subject. Referrers index JSON:"
      cat "$refjson" || true
    fi
    cat /tmp/verify.out || true
    exit 1
  fi
}

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <subject-digest> [<subject-digest> ...]" >&2
  exit 2
fi

for subject in "$@"; do
  [ -z "$subject" ] && continue
  verify_bundle_for_subject "$subject"
done


