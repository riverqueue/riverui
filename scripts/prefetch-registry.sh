#!/usr/bin/env bash

set -euo pipefail

# Prefetch container image content through a live registry deployment by
# walking the /v2 API: fetch manifest list (Docker + OCI if available),
# then each platform manifest, config, layers, and referrers.

usage() {
  cat <<'USAGE'
Usage: prefetch-registry.sh \
  --registry-host <host> \
  --repo <namespace/name> \
  --tag <tag> \
  [--run-key <nonce>] \
  [--auth-basic "user:pass"]

Notes:
  - --run-key is appended as nocache=<run-key> to bust any caches while warming.
USAGE
}

REGISTRY_HOST=""
REPO=""
TAG=""
RUN_KEY=""
AUTH_BASIC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry-host) REGISTRY_HOST="$2"; shift 2 ;;
    --repo)          REPO="$2"; shift 2 ;;
    --tag)           TAG="$2"; shift 2 ;;
    --run-key)       RUN_KEY="$2"; shift 2 ;;
    --auth-basic)    AUTH_BASIC="$2"; shift 2 ;;
    -h|--help)       usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$REGISTRY_HOST" || -z "$REPO" || -z "$TAG" ]]; then
  echo "Missing required args" >&2
  usage
  exit 2
fi

API="https://${REGISTRY_HOST}/v2/${REPO}"
NOCACHE="nocache=${RUN_KEY:-}"

if [[ -n "$AUTH_BASIC" ]]; then
  b64=$(printf '%s' "$AUTH_BASIC" | base64 | tr -d '\n')
  AUTH_HEADER=( -H "Authorization: Basic ${b64}" )
else
  AUTH_HEADER=()
fi

echo "Prefetching ${REPO}:${TAG} via ${API}"

prefetch_once() {
  # 1) Tag -> both indices (Docker manifest list and OCI image index)
  for MT in \
    'application/vnd.docker.distribution.manifest.list.v2+json' \
    'application/vnd.oci.image.index.v1+json'
  do
    echo "Prefetch tag as $MT"
    curl -fsS "${AUTH_HEADER[@]}" \
      -H "Accept: $MT" \
      "$API/manifests/$TAG?${NOCACHE}" \
      -o "index.$(echo "$MT" | sed 's/[^a-z0-9]/_/g')" || true
  done

  docker_idx="index_application_vnd_docker_distribution_manifest_list_v2_json"
  oci_idx="index_application_vnd_oci_image_index_v1_json"

  if [[ ! -s "$docker_idx" && ! -s "$oci_idx" ]]; then
    echo "No index retrieved" >&2
    return 1
  fi

  prefetch_from_index() {
    local index_json="$1"
    echo "Walking index $index_json"
    # 2) Walk descriptors -> fetch platform manifests, configs, layers
    jq -r '.manifests[] | "\(.mediaType) \(.digest)"' "$index_json" | while read -r MT D; do
      [[ -n "$D" ]] || continue
      echo "Prefetch image manifest $D ($MT)"
      MF="mf.$(echo "$D" | tr ':' '_')"
      curl -fsS "${AUTH_HEADER[@]}" -H "Accept: $MT" "$API/manifests/$D?${NOCACHE}" -o "$MF"

      # Fetch config + layers
      jq -r '.config.digest, (.layers[]? | .digest)' "$MF" | while read -r BD; do
        [[ -n "$BD" ]] || continue
        echo "Prefetch blob $BD"
        curl -fsS "${AUTH_HEADER[@]}" "$API/blobs/$BD?${NOCACHE}" -o /dev/null
      done

      # 3) Referrers for this subject
      echo "Prefetch referrers for $D"
      REF_JSON="ref.$(echo "$D" | tr ':' '_')"
      curl -fsS "${AUTH_HEADER[@]}" "$API/referrers/$D?${NOCACHE}" -o "$REF_JSON" || true
      jq -r '.manifests[]? | "\(.mediaType) \(.digest)"' "$REF_JSON" | while read -r RMT RD; do
        [[ -n "$RD" ]] || continue
        echo "Prefetch referrer $RD ($RMT)"
        curl -fsS "${AUTH_HEADER[@]}" -H "Accept: $RMT" "$API/manifests/$RD?${NOCACHE}" -o /dev/null || true
      done
    done
  }

  [[ -s "$docker_idx" ]] && prefetch_from_index "$docker_idx"
  [[ -s "$oci_idx" ]] && prefetch_from_index "$oci_idx"

  # 4) No OCI shadow tag prefetch; we publish a single tag and rely on media-type negotiation
}

# Retry up to 3 times with linear backoff
for i in 1 2 3; do
  if prefetch_once; then
    echo "Prefetch succeeded on attempt $i"
    break
  fi
  echo "Prefetch attempt $i failed; sleeping before retry"
  sleep $((i * 5))
done

# Require at least one index artifact to exist
if [[ ! -s index_application_vnd_docker_distribution_manifest_list_v2_json && ! -s index_application_vnd_oci_image_index_v1_json ]]; then
  echo "Prefetch did not retrieve any index JSON" >&2
  exit 1
fi

echo "Prefetch complete"


