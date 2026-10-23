# Kairoq local AI — observed experimental run, October 21, 2026

**Run:** https://github.com/HQTravellez/Kairoq/actions/runs/39615962037

These results come from **actual** open-source model inference and **actual** local HASTE execution in GitHub Actions, not mocked responses, but only on very small intentionally synthetic prompts. They do not demonstrate Kairoq end-to-end release readiness.

| Property | Laya local CPU | ScaleDown local HASTE |
| --- | --- | --- |
| Workload | 10 Kairoq-style intent-routing prompts | one synthetic Python program (45 distractor functions plus booking routines) |
| Real code executed | Laya Router + downloaded English checkpoint | HasteOptimizer with `semantic=False` |
| API key needed | none | none |
| Hosted inference fees | $0 | $0 |
| Accuracy/fidelity | 3/10 correct raw labels, 1/10 correct and above provisional 0.80 threshold | both required markers retained (2/2), not semantic correctness |
| Coverage | 1/10 auto-routed; other nine require review | Python context selection only |
| Latency | median 683.435 ms, p95 10,884.76 ms including first model load | 707.41 ms |
| Size | N/A | 4,332 → 500 characters; **88.46% reduction** |
| Tool/AI costs | self-hosted, hardware and development are **not free** | compute/maintenance are **not free** |
| Status | real CPU executed; unacceptable as replacement without retraining/calibration | real HASTE executed; needs JS suitability/license review |

## Honest interpretation

Laya picked the `coding` category excessively (even for design, QA and discussion), and its `answer_confidence` typically fell below 0.80. The prior local keyword baseline scored 10/10 on these hand-crafted prompts; that does **not** prove that baseline generalizes. Recommend: **do not activate Laya routing for production Kairoq**; test harder, independently labeled cases, alternative Laya checkpoints, and training before considering it.

HASTE's retrieval test selected the target Python booking validation function and retained `guest_id`, after removing repetitive unrelated code. However, HASTE **does not claim JavaScript/React support**, and selection loses other source context. It must not replace complete files or persistent memory. Its repository declares **GPL-3.0** while Python metadata says MIT; have counsel resolve before any commercial bundling.

Both GitHub CI jobs succeeded on revision `35b032e14597bdbf0414b8b7eef483bdef114f5b` (before the documentation-only follow-up). Independent adapter safety tests passed in `Integration lab smoke tests` on revision `b36c39f823e8b91d5d5d2c92205824c772b5e41f`.

## Reproducible evidence

- [Open-source local AI workflow](https://github.com/HQTravellez/Kairoq/actions/runs/39615962037)
- [Laya real inference artifact](https://github.com/HQTravellez/Kairoq/actions/runs/39615962037/artifacts/12352248216)
- [ScaleDown real HASTE artifact](https://github.com/HQTravellez/Kairoq/actions/runs/39615962037/artifacts/12352467661)
- Trial sources: `scripts/laya-local-eval.py`, `scripts/local-haste-trial.py`, `integration-lab/local-laya.js`.
- Tests: `test/local-laya.test.js`.

**No new hosted Jev or ScaleDown API keys were created, required, or used.** No customer data, production runtime, deployment or automatic actions were changed. PR remains draft.
