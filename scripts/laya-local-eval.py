#!/usr/bin/env python3
"""Real Laya CPU checkpoint evaluation, not a Jev or ScaleDown API simulation.

Uses public, synthetic Kairoq task routing cases from decision-provider-benchmark.js.
Downloads publicly released weights once; then inference runs on the runner's CPU.
No hosted inference API key, no customer data, no production wiring.
"""
import argparse
import json
import pathlib
import statistics
import time

QUESTION = {
    "route": {
        "type": "choice",
        "instructions": "Choose the ONE Kairoq specialist for this task, without executing actions or granting permissions.",
        "criteria": {
            "coding": "Requests to write, change or repair application source files",
            "api": "Requests that require learning API documentation, schemas, auth or SDKs",
            "design": "Requests about visual design, appearance, responsive layout or visual edits",
            "qa": "Requests to test, reproduce, benchmark or verify app behavior",
            "discussion": "Requests to explain, discuss or plan without editing source",
        },
    }
}


def evaluate(fixtures, threshold=0.8):
    from laya import Router

    started = time.perf_counter()
    router = Router(device="cpu")
    startup_ms = round((time.perf_counter() - started) * 1000, 2)
    results = []
    for item in fixtures:
        t0 = time.perf_counter()
        result = router.predict(item["text"], QUESTION, model="english")
        elapsed = round((time.perf_counter() - t0) * 1000, 2)
        answer = result.get("answers", {}).get("route", {})
        choice = answer.get("choice")
        value = answer.get("answer_confidence")
        if not isinstance(value, (int, float)):
            value = answer.get("probabilities", {}).get(choice)
        confident = isinstance(value, (int, float)) and 0 <= value <= 1 and value >= threshold
        routed = confident and choice in QUESTION["route"]["criteria"]
        correct = routed and choice == item["expected"]
        results.append({
            "id": item["id"],
            "expected": item["expected"],
            "selected": choice,
            "confidence": value,
            "status": "routed" if routed else "review",
            "correct": bool(correct),
            "latencyMs": elapsed,
            "inputTokens": result.get("usage", {}).get("input_tokens"),
        })
    decided = [x for x in results if x["status"] == "routed"]
    latencies = sorted(x["latencyMs"] for x in results)
    correct = sum(x["correct"] for x in results)
    return {
        "provider": "laya",
        "status": "measured-local-cpu",
        "model": "english",
        "fixtures": "public-synthetic-Kairoq-intent-10",
        "cutoff": threshold,
        "cutoffValidated": False,
        "modelStartupMs": startup_ms,
        "total": len(results),
        "decided": len(decided),
        "coverage": len(decided) / len(results),
        "overallAccuracy": correct / len(results),
        "decidedAccuracy": (correct / len(decided)) if decided else None,
        "medianLatencyMs": statistics.median(latencies),
        "p95LatencyMs": latencies[min(len(latencies)-1, int(.95*len(latencies)))],
        "hostedInferenceFeesUSD": 0,
        "note": "Compute, bandwidth, memory, and engineering expenses are not zero. Accuracy from 10 easy synthetic prompts does not prove production performance.",
        "cases": results,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    fixtures = json.loads(pathlib.Path(args.fixtures).read_text(encoding="utf-8"))
    if not isinstance(fixtures, list) or len(fixtures) != 10:
        raise ValueError("Expected exactly ten pinned public test cases")
    report = evaluate(fixtures)
    encoded = json.dumps(report, indent=2)
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    if report["total"] != 10:
        raise SystemExit(1)
