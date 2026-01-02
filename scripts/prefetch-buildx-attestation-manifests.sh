#!/usr/bin/env bash
set -euo pipefail

# Prefetch buildx "attestation-manifest" descriptors referenced directly in an OCI image index.
#
# Why: buildx can embed attestation manifests in the index's `manifests[]` with
# `annotations["vnd.docker.reference.type"]="attestation-manifest"`. Some clients try to pull them.
# In a pull-through-cache setup (ECR -> Worker -> R2), you must request these while the upstream
# still has them or they can later 404 from the R2-backed registry.
#
# Inputs:
#   - Arg1: path to an index JSON file (e.g. from `crane manifest ... > /tmp/index.json`)
#
# Environment variables:
#   - IMAGE_NAME (required): e.g. "riverqueue.com/riverproui"
#   - REGISTRY_MANIFEST_URL (required): full manifest base URL, e.g. "https://riverqueue.com/v2/riverproui/manifests"
#   - AUTH_USER (required): basic auth username
#   - AUTH_PASSWORD (required): basic auth password
#   - FORCE_FETCH_SECRET (optional): if set, sent as X-Force-Fetch-From-Upstream to force pull-through from upstream

INDEX_JSON_PATH="${1:-}"
if [[ -z "$INDEX_JSON_PATH" ]]; then
  echo "usage: $0 <index-json-path>" >&2
  exit 2
fi

: "${IMAGE_NAME:?IMAGE_NAME is required (e.g. riverqueue.com/riverproui)}"
: "${REGISTRY_MANIFEST_URL:?REGISTRY_MANIFEST_URL is required (e.g. https://riverqueue.com/v2/riverproui/manifests)}"
: "${AUTH_USER:?AUTH_USER is required}"
: "${AUTH_PASSWORD:?AUTH_PASSWORD is required}"

tmp_digests="$(mktemp)"
jq -r '
  .manifests[]?
  | select((.annotations["vnd.docker.reference.type"] // "") == "attestation-manifest")
  | .digest
' "$INDEX_JSON_PATH" | sort -u > "$tmp_digests"

if [[ ! -s "$tmp_digests" ]]; then
  echo "No buildx attestation-manifest descriptors found in index."
  exit 0
fi

echo "Prefetching buildx attestation manifests referenced by index:"
cat "$tmp_digests"

while read -r digest; do
  [[ -z "$digest" ]] && continue

  echo "Prefetching attestation manifest: $digest"

  # Ensure the pull-through cache fetches the manifest bytes from upstream and stores them.
  # Note: ORAS cannot send our custom force-refresh header, so we use curl for that part.
  curl_args=(
    -f
    -u "${AUTH_USER}:${AUTH_PASSWORD}"
    -H "Accept: application/vnd.oci.image.manifest.v1+json"
    "${REGISTRY_MANIFEST_URL}/${digest}"
    -o /dev/null
  )
  if [[ -n "${FORCE_FETCH_SECRET:-}" ]]; then
    curl_args=(
      -f
      -u "${AUTH_USER}:${AUTH_PASSWORD}"
      -H "X-Force-Fetch-From-Upstream: ${FORCE_FETCH_SECRET}"
      -H "Accept: application/vnd.oci.image.manifest.v1+json"
      "${REGISTRY_MANIFEST_URL}/${digest}"
      -o /dev/null
    )
  fi
  curl "${curl_args[@]}"

  # Warm referenced blobs so subsequent clients don't have to traverse to upstream.
  mf="$(mktemp)"
  oras manifest fetch --output "$mf" "${IMAGE_NAME}@${digest}"

  cfg="$(jq -r '.config.digest // empty' "$mf")"
  if [[ -n "$cfg" ]]; then
    oras blob fetch --output /dev/null "${IMAGE_NAME}@${cfg}"
  fi

  jq -r '.layers[]?.digest // empty' "$mf" | while read -r layer_digest; do
    [[ -n "$layer_digest" ]] && oras blob fetch --output /dev/null "${IMAGE_NAME}@${layer_digest}"
  done
done < "$tmp_digests"


