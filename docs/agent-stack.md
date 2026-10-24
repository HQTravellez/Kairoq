# Modular agent stack

Kairoq's Node/CommonJS server, React/Vite builder, `react-agent` tool loop,
project metadata, SQLite runtime, guarded Playwright QA and human approvals remain
responsible for application behavior. These integrations do not install third-party
session hooks, replace the agent loop, activate learned skills, or grant publishing authority.

## Integration status

| Source | Implemented boundary | Verification and limits |
| --- | --- | --- |
| ECC | Existing `ecc-context-recall.js` concept adaptation, used by Build, Discuss and Agent. Added opt-out and finite scan/limit handling. | Local project recall tested. This is **ECC-inspired**, not installation of ECC CLI, its hooks, or its full memory system. |
| Mem0 | Local self-hosted REST adapter; optional read-only enrichment in Build, Discuss and Agent. Writes require separate explicit export approval. | Real local HTTP contract tests and real Discuss pipeline pass. **Actual Mem0 server, vector persistence, model extraction and semantic quality remain unverified.** Disabled by default. |

All upstream source commits and licenses are recorded in
`integrations/agent-stack/upstreams.json`. They are review pins, not automatically
installed production dependencies. Kairoq package dependencies and lockfile are unchanged.
No upstream implementation code is vendored.

## Why these boundaries

Recent main PR #122 already introduced ECC-inspired recall. PRs #121 and #120 changed
chat continuity and responsiveness; PRs #123–126 repaired adjacent deletion-route syntax.
Reinstalling ECC host hooks on top would create overlapping session,
memory and learning authorities. Kairoq already has `project-memory.js`,
`hermes-learning-loop.js`, `api-skill-memory.js`, and its own approval-gated agent loop.

ECC recalls owner history; Mem0 returns optional unverified historical data; Hermes
retains the existing evidence gates.

Understand-Anything, Ruflo and AutoHarness adapters were removed in October 2026: nothing
in the running app called them (they were operator-only scripts).

## Reproducible verification

```sh
node --test test/agent-stack.test.js test/agent-stack-builder.test.js \
  test/ecc-context-recall.test.js test/hermes-learning-loop.test.js \
  test/responsive-builder-chat.test.js
```

The ordinary tests require no upstream installation or credentials. They exercise real
local HTTP and subprocess boundaries with synthetic fixtures; they do not claim real
Mem0/model operation. `agent-stack-builder.test.js` runs the actual Discuss path and
checks the model receives ECC plus scoped, explicitly unverified Mem0 context.
Existing browser/runtime suites cover desktop/mobile, sign-in, private records and
workflows; model responses in builder tests are scripted rather than paid live calls.

See `docs/agent-stack-evidence.md` for this branch's actual results and outstanding gates.

## Faster conversation and concept continuity

Follow-up fixes address specific delays found during this integration review:

- Discuss with attached screenshots preserves `vision`/premium routing and the image
  payload; it no longer forces images through the text-only chat lane. Vision still
  requires the existing provider configuration, budget and paid-use policy.
- OpenRouter text-chat provider attempts now time out after 12 seconds by default,
  configurable through `KAIROQ_CHAT_ATTEMPT_TIMEOUT_MS`. Build/vision budgets remain
  separate. Provider failover can still take multiple attempts; no live latency SLA
  or model-quality improvement is claimed.
- Selecting Discuss while a build runs sends a separate read-only conversation and
  preserves the original build watcher. A second mutating build is still refused.
- Preference extraction runs in the existing background task tracker instead of
  holding the build's completion event. Agent results now expose the real completion
  verdict; explicitly unverified agent runs cannot trigger recipe creation/improvement.
- `app-concept.js` derives the original brief and recent directions from durable owner
  history for Build/Discuss/Agent, and asks for relevant suggestions explicitly labeled
  as proposals. No additional summarization model call is introduced. This is prompt
  grounding, not proof of autonomous product judgment or image comprehension.

The browser test uses the actual wrapped chat functions in a controlled Chrome harness;
it verifies UI streaming/watcher behavior, not a live model or hosted deployment. Screenshot
routing is tested at the real Discuss boundary; semantic understanding by a real vision
provider remains unverified. Native source validation, saved checks, sandbox browser tests
and independent feature acceptance remain the code-review/completion authority.

Additional conversation fixes reject provider safety-classification dumps and raw,
unexecuted tool delimiters instead of storing them as assistant answers. The Discuss
prompt describes the server's actual public-document research capability and asks for
a documentation URL when missing. The injected guarded browser-session dependency is
now forwarded through the API handler into research and agent execution; its previous
omission could leave configured integrations unused. These are wiring/contract fixes,
not proof that an arbitrary third-party Browser Use server is connected and healthy.
