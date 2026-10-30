#!/usr/bin/env python3
"""Kairoq → Graphify deterministic AST bridge.

Input is a temporary Kairoq-owned workspace containing only approved project
source files. This bridge deliberately uses Graphify's structural extractor
only: no semantic LLM pass, network access, hooks, MCP server, or repo mutation.
"""
from __future__ import annotations
import importlib.metadata
import json
import sys
from pathlib import Path

CODE_SUFFIXES = {
    ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs",
    ".java", ".c", ".h", ".cc", ".cpp", ".hpp", ".rb", ".cs", ".kt",
    ".kts", ".scala", ".php",
}

def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "workspace path required"}))
        return 2
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print(json.dumps({"error": "workspace does not exist"}))
        return 2
    try:
        from graphify.extract import extract
    except Exception as exc:
        print(json.dumps({"error": f"graphify unavailable: {exc}"}))
        return 3

    files = [
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in CODE_SUFFIXES
        and ".git" not in p.parts and "node_modules" not in p.parts
    ]
    files.sort(key=lambda p: p.as_posix())
    if not files:
        print(json.dumps({"nodes": [], "edges": [], "upstream_version": "unknown"}))
        return 0

    try:
        result = extract(files)
        result["upstream_version"] = importlib.metadata.version("graphifyy")
        result["mode"] = "deterministic-ast-only"
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"graphify extraction failed: {type(exc).__name__}: {exc}"}))
        return 4

if __name__ == "__main__":
    raise SystemExit(main())
