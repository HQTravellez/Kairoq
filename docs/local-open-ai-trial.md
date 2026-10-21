# Kairoq local open-source AI proof (no hosted Jev/ScaleDown inference keys)

**Status:** experimental, no production imports or deployment. This branch includes two distinct trials: Laya local weights for specialist routing, and ScaleDown's *local HASTE* AST selection for **Python code only**.

## 1. Laya local Jev-compatible decision engine

- Upstream: https://github.com/NandhaKishorM/laya
- License: Apache-2.0 source, verify individual checkpoint licenses and hardware constraints before production.
- `integration-lab/local-laya.js` calls **only** `http://127.0.0.1:8000/v1/systemone` (or another explicitly numeric local port); no user-defined remote endpoint accepted. It uses existing Kairoq handler labels, checks the returned `answer_confidence` rather than Jev's different entropy confidence, and returns `review` or `unavailable` rather than executing work.
- Provisional 0.80 threshold is **not calibrated**. Fit a cutoff on held-out real Kairoq task labels before routing real users.
- Loopback is appropriate on the same machine. In a separate container, loopback points to that container, not to the host; use a separately secured relay or co-locate the evaluation process. **Do not expose the unauthenticated Laya endpoint publicly.**

To try on a dedicated local development machine (requires free model download and local compute):

```sh
python3 -m venv .venv-laya
. .venv-laya/bin/activate
python -m pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_DEVICE=cpu LAYA_MODELS=english LAYA_PRELOAD=1 laya-serve
```

From a second terminal in this repo:

```sh
node -e 'require("./integration-lab/local-laya").routeLocal("Read an OpenAPI hotel specification").then(console.log)'
```

There is no TypeSafe/Jev API call. GitHub Actions job `local-laya` tests actual Laya CPU inference on ten synthetic routing cases after downloading its public model weights. Its artifact reports route coverage, accuracy, per-case latency, and abstentions. Running the model on your own hardware does not mean compute is free.

## 2. ScaleDown local HASTE optimizer

- Upstream: https://github.com/scaledown-team/scaledown
- This repo's `LICENSE` file is **GPL-3.0** (the Python packaging metadata says MIT; treat this as a licensing conflict needing resolution). It is installed only in an isolated GitHub Actions Python trial, not bundled with Kairoq's proprietary runtime.
- `scripts/local-haste-trial.py` exercises `HasteOptimizer(semantic=False)` on public synthetic **Python** functions without `SCALEDOWN_API_KEY`, without remote prompt compression or paid embeddings.
- It checks whether the selected fragment preserves `validate_booking` and `guest_id` while tracking duration and character reduction. This does **not** establish preservation of arbitrary data, JavaScript support, token savings on real customer apps, or semantic equivalence.

To run the real HASTE trial on a dedicated Python 3.11 environment:

```sh
python -m pip install 'scaledown[haste]==0.1.0'
python scripts/local-haste-trial.py --out benchmark-artifacts/local-haste.json
```

## What will count as proof

- The integration-lab CI must pass the **actual adapter unit tests**.
- The separate `Open-source local AI trial` GitHub Action must produce an artifact after real model inference and Python HASTE execution. A job that fails during installation is **not** proof of inference.
- Compare a harder, independent human-labeled set of real Kairoq tasks to Kairoq's current router. Assess class balance, failure safety, p50/p95 including startup, hardware usage, real-user confidence calibration, and engineering/compute cost.
- Test JavaScript/TypeScript code retrieval separately. ScaleDown HASTE focuses on Python; it should not be presented as a drop-in optimizer for Kairoq's React/Node builder.
- Do not merge GPL components or ship decision routing until license review and full-stack benchmarks pass.

**Source of truth:** PR #99 remains a draft. Any local benchmark artifacts report *only* their stated fixtures, model version, environment and execution conditions.
