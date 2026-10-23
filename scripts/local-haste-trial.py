#!/usr/bin/env python3
"""Isolated, offline HASTE trial. Never imports ScaleDown into Kairoq runtime.

    python scripts/local-haste-trial.py --out /tmp/haste-metrics.json

Dependency for experiments only:
    python -m pip install 'scaledown[haste]==0.1.0'

The installed HASTE implementation selects *Python* code, not general JavaScript
or arbitrary untrusted user-provided repositories. It does not call ScaleDown's API.
"""
import argparse
import json
import pathlib
import tempfile
import time

# Synthetic, public code. Repetitive distractions make reduction measurable.
CODE = (
    "def unrelated_%03d(value):\n"
    "    return value.upper() if isinstance(value, str) else value\n\n"
)
SOURCE = "".join(CODE % i for i in range(45))
SOURCE += """
def validate_booking(booking):
    if "guest_id" not in booking:
        raise ValueError("guest_id is required")
    if booking.get("nights", 0) < 1:
        raise ValueError("nights must be positive")
    return booking

def create_booking(booking):
    clean = validate_booking(booking)
    return {"id": "bk-17", **clean}
"""
QUERY = "find validate_booking and the required guest_id error"
REQUIRED = ("validate_booking", "guest_id")


def evaluate():
    from scaledown.optimizer import HasteOptimizer

    started = time.perf_counter()
    # semantic=False avoids OpenAI embeddings and API keys entirely.
    optimizer = HasteOptimizer(top_k=4, semantic=False, hard_cap=420, soft_cap=450)
    with tempfile.TemporaryDirectory(prefix="kairoq-haste-") as directory:
        filename = pathlib.Path(directory) / "fixture.py"
        filename.write_text(SOURCE, encoding="utf-8")
        result = optimizer.optimize(context="", query=QUERY, file_path=str(filename))
    output = result.content or ""
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    return {
        "provider": "scaledown-haste-local",
        "status": "measured-local" if output else "no-selection",
        "source": "public-synthetic-Python-only",
        "query": QUERY,
        "sourceChars": len(SOURCE),
        "selectedChars": len(output),
        "charReduction": round(1 - len(output) / len(SOURCE), 4),
        "requiredMarkers": list(REQUIRED),
        "retainedMarkers": [term for term in REQUIRED if term in output],
        "markerRecall": sum(term in output for term in REQUIRED) / len(REQUIRED),
        "durationMs": duration_ms,
        "scaleDownApiCalls": 0,
        "scaleDownApiFeesUSD": 0,
        "note": "Not a semantic-equivalence guarantee or JavaScript selector benchmark; optional GPL-3.0 experiment only.",
        "selectedExcerpt": output[:500],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", help="Optional JSON results artifact")
    args = parser.parse_args()
    result = evaluate()
    encoded = json.dumps(result, indent=2)
    if args.out:
        output_path = pathlib.Path(args.out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    if result["status"] != "measured-local" or result["markerRecall"] != 1:
        raise SystemExit(1)
