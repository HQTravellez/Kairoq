#!/bin/sh
# Kairoq wrapper around the official Hermes image entrypoint.
# 1. Fill in defaults for the model settings referenced by config.yaml.
# 2. Install Kairoq's locked-down config.yaml into the persistent volume.
# 3. Hand over to the unmodified upstream dispatcher (s6 supervision etc.).
set -eu

: "${HERMES_HOME:=/opt/data}"
: "${KAIROQ_CONFIG_SRC:=/opt/kairoq/config.yaml}"
: "${HERMES_DISPATCH:=/opt/hermes/docker/entrypoint-dispatch.sh}"
export HERMES_HOME
export KAIROQ_HERMES_PROVIDER="${KAIROQ_HERMES_PROVIDER:-openrouter}"
export KAIROQ_HERMES_MODEL="${KAIROQ_HERMES_MODEL:-openrouter/free}"
export KAIROQ_HERMES_BASE_URL="${KAIROQ_HERMES_BASE_URL:-https://openrouter.ai/api/v1}"

# The API server is the only way in. It listens on every interface (set in
# config.yaml) on Railway's PORT; Kairoq still has to present API_SERVER_KEY.
export API_SERVER_ENABLED=true
export API_SERVER_PORT="${API_SERVER_PORT:-${PORT:-8642}}"
API_SERVER_KEY="${API_SERVER_KEY:-}"
if [ "${#API_SERVER_KEY}" -lt 32 ]; then
  echo "[kairoq] API_SERVER_KEY must be set to a random secret of at least 32 characters (e.g. openssl rand -hex 32)." >&2
  exit 64
fi
export API_SERVER_KEY

mkdir -p "$HERMES_HOME"
cp "$KAIROQ_CONFIG_SRC" "$HERMES_HOME/config.yaml"
# A key saved in the volume's .env would override the one Railway provides.
if [ -f "$HERMES_HOME/.env" ]; then
  sed -i '/^API_SERVER_KEY=/d' "$HERMES_HOME/.env"
fi

# No arguments → run the gateway (which serves the API server).
if [ "$#" -eq 0 ]; then
  set -- gateway run
fi
exec "$HERMES_DISPATCH" "$@"
