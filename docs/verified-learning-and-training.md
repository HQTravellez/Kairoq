# Verified procedural learning and a model-training path

## What is implemented

`verified-learning.js` captures a small procedural observation after an executor proves
that the current source builds and its sandbox workflow passes an interaction and an
assertion. Agent runs use the real completion verdict, browser results and source digest;
Build mode captures only passing independent feature journeys. Stopped, failed, skipped,
unasserted, and screenshot-only runs do not qualify. The model has no capture/promotion tool.

Capture is a background local disk operation. It makes no model, embedding, web or training
calls. It keeps a source hash, source version, allowlisted tool names, coarse workflow
categories and a generic procedure derived from the executed sequence. Raw code, prompts,
error bodies, screenshots, customer names and tool arguments are not recorded. Consequently
this is **procedural evidence**, not a dataset of code repairs or a newly trained model.

Build, Agent and Discuss retrieve a bounded set of matching observations before their next
model request. They are labeled historical observations, not current implementation proof
or instructions. Matching is a fixed local keyword taxonomy, not semantic vector retrieval.
Both owner and project IDs determine storage scope. The existing unscoped legacy Hermes
repair records remain in place; this change does not migrate or expose those records.

Records use the existing append-only autonomy store (`KAIROQ_AUTONOMY_DIR` or the persistent
volume's `.kairoq-autonomy/`). They share its 1,000-record review window and 5 MB file limit.
Sequential identical captures deduplicate; simultaneous captures can still produce duplicate
records. Reviewed training examples additionally deduplicate equivalent procedures. This
store is not suitable for a million-document corpus.

Disable new capture and injected notes with `KAIROQ_VERIFIED_LEARNING=off`. This does not
disable other existing memory modules or erase stored records. Store failure never prevents
the build/discussion response. The background recorder is best-effort, not a durable job
queue; process termination can lose an in-flight capture.

## Review, revoke, and export

Run these operator commands in the trusted server environment with the intended project
metadata and persistent volume. They are not model tools or public API endpoints:

```sh
node scripts/learning-data.js list PROJECT_ID
node scripts/learning-data.js review PROJECT_ID DIGEST --approve
node scripts/learning-data.js revoke PROJECT_ID DIGEST
node scripts/learning-data.js export PROJECT_ID > /tmp/reviewed-procedures.jsonl
```

No example exports until separately reviewed. Revocation immediately excludes the run
from recall and export even if previously reviewed. Export is a local JSONL file with
conversational `messages` and evidence-hash metadata. Existing downloaded exports are not
automatically erased or recalled; the operator must handle those artifacts separately.

The exported response teaches a verified process (batch files, compile, exercise, assert).
It is a **candidate input format** for supervised fine-tuning, not evidence that a trainer
has run or that its behavior improves. It contains neither the actual good application
code nor detailed fixes. Do not market it as training Kairoq on customer source code.

## How millions of documents relate to Hermes

Hermes Agent can use different underlying models. In the supplied screenshots its model
selector shows Gemma4:31B Cloud. A statement by that assistant about learning from many
examples is not evidence that this installed Hermes instance trained itself on those
examples. Base-model training, agent memory/skills and a file-writing script are distinct.

Hermes documents reusable skills and a separate Atropos-based RL training route:
- https://hermes-agent.nousresearch.com/docs/guides/work-with-skills
- https://hermes-agent.nousresearch.com/docs/getting-started/learning-path

For Kairoq, use three stages:

1. **Relevant documentation retrieval:** index approved, licensed documents with provenance,
   versions, access scopes, deduplication and deletion support. Search for only the chunks
   relevant to a task. Large-scale indexing does not change model weights. This PR does
   not implement that document pipeline or crawl/download a corpus.
2. **Task fine-tuning:** choose a model/provider that permits fine-tuning; collect rights-cleared,
   sanitized request/solution pairs and verified tool traces. Add actual code solutions only
   after separate export authorization. Split training and evaluation by project/source family
   and deduplicate across splits to avoid leakage. Start with a curated pilot and compare
   against the unchanged base model; dataset quality matters more than an arbitrary count.
3. **Optional RL:** only after an isolated executor and reliable task-specific rewards exist,
   train on compilation, independent functional tests and tool correctness. Prevent reward
   shortcuts such as removing assertions, disabling auth or inventing passed tests. Compare
   accuracy, regressions, tool errors, latency and cost on held-out tasks before release.

Training a foundation model on millions of documents additionally needs tokenizer/data
processing, distributed accelerators, checkpoints, compute budgets and broad evaluations.
That is a separate infrastructure program. This PR allocates no GPUs, downloads no base
model, uploads no records and starts no paid training.

A compatible trainer can consume conversational supervised examples, but it requires actual
model/dataset selection and execution. Reference: https://huggingface.co/docs/trl/en/sft_trainer

## Evidence and limits

The synthetic retrieval benchmark (`node scripts/benchmark-learning.js`) uses four unseen
wordings against captured categories. It reports baseline and learned retrieval matches
and checks cross-owner isolation. **It does not measure code-generation quality, model
learning, semantic understanding or real inference latency.**

Tests cover rejected evidence, scope isolation, review/revocation, deduplication, disable
behavior and cross-process persistence. The browser integration test performs a real Vite
build and a counter click/assertion, waits for capture, then proves the next actual Discuss
request receives the saved procedure. Model replies in this test are scripted.

No model weights have been trained. No live-model improvement or production enablement is
claimed. Existing broader-suite baseline failures are documented in agent-stack-evidence.md.

Verified for this change: **49 local tests passed, 0 failed/skipped** (including the
real browser capture-to-next-Discuss round trip and builder regressions); the production
Docker image builds and **22 focused tests pass on Node 22** inside it. Syntax checks
pass. The retrieval-only fixture benchmark reports 0/4 baseline matches and 4/4 learned
matches with no cross-owner result. Full-suite and live-model improvement are not claimed.
