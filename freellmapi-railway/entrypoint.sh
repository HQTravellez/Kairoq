#!/bin/sh
set -eu

# Start the upstream entrypoint unchanged. It initializes the database, fixes
# Railway volume ownership, drops privileges, and starts FreeLLMAPI.
# The synchronizer never prints the secret; it only replaces the generated
# unified proxy key once the settings table exists.
if [ -z "${KAIROQ_FREELLMAPI_UNIFIED_KEY:-}" ]; then
  echo "[kairoq-freellmapi] KAIROQ_FREELLMAPI_UNIFIED_KEY is required" >&2
  exit 1
fi

/usr/local/bin/docker-entrypoint.sh "$@" &
app_pid=$!

cleanup() {
  kill -TERM "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}
trap cleanup INT TERM

synced=0
i=0
while [ "$i" -lt 60 ]; do
  if node /opt/kairoq/sync-unified-key.cjs; then
    synced=1
    break
  fi
  if ! kill -0 "$app_pid" 2>/dev/null; then
    wait "$app_pid"
    exit $?
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$synced" -ne 1 ]; then
  echo "[kairoq-freellmapi] unified key synchronization did not complete" >&2
  cleanup
  exit 1
fi

wait "$app_pid"
