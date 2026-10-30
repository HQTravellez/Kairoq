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
        result = extract(files, root=root, cache_root=root, parallel=False)

        # Kairoq's graph API uses project-relative file identities. Graphify's
        # language extractors may initially emit absolute paths; never retain
        # the ephemeral /tmp workspace path after analysis.
        def rel_source(value: object) -> str:
            if not value:
                return ""
            try:
                p = Path(str(value))
                if not p.is_absolute():
                    p = (root / p).resolve()
                else:
                    p = p.resolve()
                return p.relative_to(root).as_posix()
            except (ValueError, OSError):
                return ""

        for collection in ("nodes", "edges", "hyperedges"):
            for item in result.get(collection, []) or []:
                if isinstance(item, dict) and "source_file" in item:
                    item["source_file"] = rel_source(item.get("source_file"))

        result["upstream_version"] = importlib.metadata.version("graphifyy")
        result["mode"] = "deterministic-ast-only"
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"graphify extraction failed: {type(exc).__name__}: {exc}"}))
        return 4

if __name__ == "__main__":
    raise SystemExit(main())
