#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
bridge = repo / "scripts" / "graphify-kairoq.py"

with tempfile.TemporaryDirectory(prefix="kairoq-graphify-smoke-") as td:
    root = Path(td)
    (root / "src").mkdir()
    (root / "src" / "auth.js").write_text(
        "export function login(user){ return normalize(user); }\n"
        "export function normalize(user){ return String(user).trim(); }\n",
        encoding="utf-8",
    )
    result = subprocess.run(
        [sys.executable, str(bridge), str(root)],
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit("bridge failed: " + result.stdout + "\n" + result.stderr)

    data = json.loads(result.stdout)
    assert data["upstream_version"] == "0.1.14", data
    assert data["mode"] == "deterministic-ast-only", data
    assert data["nodes"], data

    source_files = [
        item.get("source_file", "")
        for group in ("nodes", "edges", "hyperedges")
        for item in data.get(group, []) or []
        if item.get("source_file")
    ]
    assert source_files, data
    assert all(not Path(p).is_absolute() for p in source_files), source_files
    assert all(not p.startswith("/tmp/") for p in source_files), source_files
    assert any(p == "src/auth.js" for p in source_files), source_files
    labels = {n.get("label") for n in data["nodes"]}
    assert any("login" in str(x).lower() for x in labels), labels

print("graphify bridge smoke: ok")
