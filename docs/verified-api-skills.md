# Verified API skill evolution

This module generates operation-specific guidance from **stored actual API execution evidence** in `autonomy-store`. It automatically proposes, benchmarks and promotes versioned skills through `learn()`.

- Evidence types: schema mismatch, unexpected HTTP status, bounded read transport failures, verified successes.
- Memory: append-only project JSONL; saved rules survive process restart when `KAIROQ_AUTONOMY_DIR` uses persistent storage.
- Evaluation: fixed, code-owned train and holdout cases measure **guidance selection**, not live API integration performance.
- Only a measured improvement can be promoted. Calling `promote()` with self-reported scores has no effect.
- Integrate through `/api/developer/api/autonomy/skills/learn` and `/api/developer/api/autonomy/skills/active`. Both require authenticated workspace access.
- Optional `KAIROQ_AUTONOMY_AUTO_SKILLS=true` runs the learning step after evidence recording. Neither credentials nor raw responses are stored in skill memory.

Limitations: no LLM fine-tuning or self-editing source code; actual API runtime tests and app repair must be evaluated separately. The fixed routing benchmark is intentionally narrower than a product integration benchmark.
