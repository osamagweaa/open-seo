#!/usr/bin/env bash
# Starts OpenSEO on a Runpod pod. The pod's start command clones this repository
# and runs this script from the checkout; see docs/SELF_HOSTING_RUNPOD.md.
#
# Everything that must outlive a restart lives on the network volume at
# /workspace: the database and the two secrets generated below. The checkout,
# dependencies and build output sit on the container disk and are rebuilt on
# every start.
set -euo pipefail

STATE="${OPENSEO_STATE_DIR:-/workspace/openseo}"
PORT="${PORT:-3001}"
mkdir -p "$STATE"

# Secrets are generated once and kept on the volume, so they never pass through
# the pod configuration or a chat window.
secret() {
  if [ ! -s "$STATE/$1" ]; then
    (umask 077 && openssl rand -hex 32 >"$STATE/$1")
  fi
  cat "$STATE/$1"
}
BETTER_AUTH_SECRET="$(secret better-auth-secret)"
OPENSEO_OPERATOR_SECRET="$(secret operator-secret)"
export BETTER_AUTH_SECRET OPENSEO_OPERATOR_SECRET

# Runpod serves each exposed HTTP port at https://<pod id>-<port>.proxy.runpod.net.
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-https://${RUNPOD_POD_ID:?RUNPOD_POD_ID is not set}-${PORT}.proxy.runpod.net}"
export AUTH_MODE=password
export PORT
export CLOUDFLARE_INCLUDE_PROCESS_ENV=true
export VITE_SHOW_DEVTOOLS=false

# Keep the local database, KV and file state on the volume.
mkdir -p "$STATE/wrangler"
ln -sfn "$STATE/wrangler" .wrangler

corepack enable
corepack prepare pnpm@10.30.1 --activate
pnpm install --frozen-lockfile

echo "OpenSEO will be served at $BETTER_AUTH_URL"
exec sh deploy/docker/docker-entrypoint.sh
