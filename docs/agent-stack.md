# Modular agent stack

Kairoq's Node/CommonJS server, React/Vite builder, `react-agent` tool loop,
project metadata, SQLite runtime, guarded Playwright QA and human approvals remain
responsible for application behavior. These integrations do not install third-party
session hooks, replace the agent loop, activate learned skills, or grant publishing authority.

## Integration status

| Source | Implemented boundary | Verification and limits |
| --- | --- | --- |
| ECC | Existing `ecc-context-recall.js` concept adaptation, used by Build, Discuss and Agent. Added opt-out and finite scan/limit handling. | Local project recall tested. This is **ECC-inspired**, not installation of ECC CLI, its hooks, or its full memory system. |
| Understand-Anything | AST-based file/import graph export in its knowledge-graph format; reverse dependency and impacted-test calculation. | Actual pinned upstream Zod schema accepts the graph. Static graph only; semantic analysis, dashboard and automated incremental hooks are not embedded. |
| Ruflo | Explicit isolated stdio MCP initialize and tools/list probe. | Real pinned `ruflo@3.60.1` responds. Capability discovery only; no tools/call, agent spawning, memory sharing, or orchestration takeover. Experimental. |
| Mem0 | Local self-hosted REST adapter; optional read-only enrichment in Build, Discuss and Agent. Writes require separate explicit export approval. | Real local HTTP contract tests and real Discuss pipeline pass. **Actual Mem0 server, vector persistence, model extraction and semantic quality remain unverified.** Disabled by default. |
| AutoHarness | Imports project-level `stage_skill` create intents into durable, owner/project-scoped Kairoq review candidates. | Actual upstream Python stage/queue output successfully round-trips into the Kairoq log. No reflection models, promoter, deletion/update lifecycle, hook installation or active-skill writes. Experimental. |

All upstream source commits and licenses are recorded in
`integrations/agent-stack/upstreams.json`. They are review pins, not automatically
installed production dependencies. Kairoq package dependencies and lockfile are unchanged.
No upstream implementation code is vendored.

## Why these boundaries

Recent main PR #122 already introduced ECC-inspired recall. PRs #121 and #120 changed
chat continuity and responsiveness; PRs #123–126 repaired adjacent deletion-route syntax.
Reinstalling ECC/Ruflo/AutoHarness host hooks on top would create overlapping session,
memory and learning authorities. Kairoq already has `project-memory.js`,
`hermes-learning-loop.js`, `api-skill-memory.js`, and its own approval-gated agent loop.

ECC recalls owner history; Mem0 returns optional unverified historical data; Hermes
retains the existing evidence gates. AutoHarness candidates have a separate event type
and namespace and cannot enter Hermes verified recall. Static graphs advise review,
not proof that a feature exists. Ruflo capabilities never authorize tool execution.

## Operator commands

Use Node 22.13+ and `npm ci`. These commands do not install upstream hooks:

```sh
node scripts/agent-stack.js status
# Requires a clean committed checkout; never overwrite an existing .ua graph.
node scripts/agent-stack.js graph > /tmp/kairoq-knowledge-graph.json
node scripts/agent-stack.js stage-autoharness OWNER_ID PROJECT_ID /tmp/reviewed-intent.json
node scripts/agent-stack.js ruflo-capabilities /absolute/reviewed/ruflo
```

`graph` includes tracked source/document/config files, excludes secret dotenv files,
uses Babel to distinguish real imports from comments and strings, and records the
exact source commit. It reports unresolved imports and does not invent semantics.
Use `impact(graph, changedPaths, {commit, files})` from `understand.js` to calculate
reverse dependants, including tests. Rejects stale commits, path traversal, duplicate
nodes and dangling/unsupported edges. This is a constrained interchange subset, not
an importer for arbitrary full semantic graphs.

To view the export in Understand-Anything, copy it to `.ua/knowledge-graph.json`
**in a separate inspection checkout** and use the upstream viewer. Viewer rendering
has not been verified here. Do not enable upstream auto-update hooks.

AutoHarness import is an operator-only action; OWNER_ID and PROJECT_ID are trusted
inputs from an authenticated workflow, never arbitrary public request fields. The
module refuses global proposals, updates, deletions, executable subfiles and oversized
records. Candidates are unverified data, stored via Kairoq's append-only autonomy store.
Identical sequential proposals deduplicate; concurrent submissions may produce duplicates.
Promotion is intentionally unavailable; evaluate any proposed learning through the existing
Hermes/API evidence and independent benchmark gates before considering activation.

Ruflo's executable is reviewed separately and runs in a temporary working directory
with an isolated HOME and minimal environment. Only initialize and tools/list are sent.
Tool names are returned as data, never loaded into Kairoq's live tool registry. The probe
limits output and time, kills the child, and removes the temporary directory. This is
process/environment isolation, not an OS security sandbox for arbitrary untrusted binaries.

## Mem0 opt-in configuration

The production enrichment flag is **off**. Set all three only after isolated validation:

```dotenv
KAIROQ_MEM0_ENABLED=on
KAIROQ_MEM0_URL=http://127.0.0.1:8000
KAIROQ_MEM0_API_KEY=<dedicated self-hosted server key>
```

Only credential-free loopback HTTP origins are accepted; redirects are refused. The
server key travels in `X-API-Key`, never in generated apps, URLs, logs or model context.
Owner and project IDs are hashed together into `user_id`, with `agent_id=kairoq`.
Search fixes both filters and refuses results missing or mismatching that scope.
The authenticated caller must load the correct project metadata first; filters are
an additional boundary, not a substitute for server authentication/authorization.

The request path only searches; it never automatically exports conversations. Opting
in transmits each query to the separately operated local Mem0 server. Its configured
embedding/model services can make external calls and incur costs; loopback transport
does not imply offline processing. Use synthetic data before any customer enablement.

A separately authorized export calls `client(...).add(text, {approved:true})`, retains
only user text and sets `infer:false` and unverified metadata. This avoids automatic
LLM extraction on that write but does not prove the server is wholly offline.
No destructive Mem0 endpoints are exposed. Common key/password patterns are rejected;
this heuristic is not comprehensive PII/secret redaction. Callers must sanitize data.

Optional prompt enrichment is bounded, marked as untrusted data and times out after
800 ms. Configuration, service, scope and timeout failures return no extra note;
existing local ECC and project memory remain usable. Disable with
`KAIROQ_MEM0_ENABLED=off`; `KAIROQ_ECC_RECALL=off` independently disables the ECC note.

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

Optional upstream verification requires separate checkouts at every pinned commit:

```sh
KAIROQ_UPSTREAM_CHECKOUTS=/path/to/upstream-checkouts \
KAIROQ_RUFLO_BIN=/absolute/pinned/ruflo \
node scripts/verify-agent-stack-upstreams.js
```

Checkout directory names must match the manifest keys. Install pinned Ruflo separately,
with install scripts disabled during review. Python 3.11+ is required for the actual
AutoHarness stage test. The verifier compiles the upstream graph schema, invokes actual
AutoHarness staging against temporary data, tests durable candidate storage, and optionally
performs the real Ruflo handshake. It makes no LLM calls and installs no hooks. Ordinary
CI tests Node 22 and 24 and uploads the static graph; upstream runtime checks are optional
and must never be inferred from a green offline-contract job.

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
