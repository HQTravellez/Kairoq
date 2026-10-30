#!/usr/bin/env bash
set -euo pipefail
export CLI_HUB_NO_ANALYTICS=1
echo "== CLI-Anything hub read-only inventory =="
command -v cli-hub
cli-hub --help >/dev/null
cli-hub list --json > /tmp/kairoq-cli-hub-inventory.json
python3 -m json.tool /tmp/kairoq-cli-hub-inventory.json >/dev/null
echo "CLI hub list: PASS"
echo "== REA static JavaScript inspection =="
command -v rea
rea --help >/dev/null
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
printf 'const answer = () => 42; module.exports={answer};\n' > "$dir/index.js"
printf '{"name":"kairoq-smoke-target","version":"1.0.0","main":"index.js"}\n' > "$dir/package.json"
rea analyze-javascript-application "$dir" --json > /tmp/kairoq-rea-inspection.json
python3 -m json.tool /tmp/kairoq-rea-inspection.json >/dev/null
echo "REA local static analysis: PASS"
