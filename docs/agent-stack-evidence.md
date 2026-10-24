# Verification evidence — 2026-10-23 (Toronto)

Base: `de948bddbadff744d8395b06927a85648359b95c` on `HQTravellez/Kairoq/main`.
Draft integration work only. No merge or deployment performed.

## Verified locally

- Initial focused integration/runtime set: 41 passed, 0 failed, 0 skipped. Includes
  actual builder edits and retry, project recall after 70 changes, generated app
  sign-in/privacy, desktop/mobile browser workflows, and existing integration lab.
- Final conversation/adapter set: 46 passed, 0 failed, 0 skipped on Node 24.19.0.
  Includes screenshot payload + vision routing, actual Discuss with scoped local
  memory, concurrent read-only discussion, background preference completion, app
  concept context, provider-protocol rejection and real Chrome UI watcher test.
- `npm run check` passes. Modified browser chat script also syntax checked.
- Actual pinned Understand-Anything schema accepts the deterministic export. Full
  repository graph exported successfully: 711 nodes, 1,141 import edges and 42
  unresolved imports at implementation commit f99b783 (before later conversation
  changes). A graph is static evidence only and must be regenerated for a new commit.
- Actual `ruflo@3.60.1` MCP initialization and tool listing succeed with no tools/call.
- Actual pinned AutoHarness Python stage/queue output round-trips into a durable,
  inert Kairoq candidate. No active skill directories created.
- Production Docker image builds successfully. Initial Node 22 container adapter set:
  28 passed, 0 failed, 0 skipped. Final Node 22 container verification: **40 passed, 0 failed, 0 skipped**.
  No hosted deployment was used.

All data and model replies in ordinary integration tests are synthetic. The HTTP and
subprocess tests exercise real transport boundaries, not real Mem0/model intelligence.
The injected browser wiring test uses a controlled session to prove evidence forwarding;
existing native browser tests use Chrome for real UI checks.

## Full-suite result and baseline comparison

`node --test --test-concurrency=2 --test-timeout=300000 test/*.test.js`
with Chrome on the initial integration branch finished in 410.5 seconds:
**650 tests, 638 passed, 8 failed, 4 skipped**. This run preceded the final follow-up
conversation fixes; the final source has focused coverage, not a second full-suite pass.

All eight failing cases were reproduced on an untouched archive of the base commit:

| File | Failing scenario / observed mismatch |
| --- | --- |
| create-checks.test.js | Agent saved-flow script runs out of model replies under the completion gate. |
| create-edits.test.js | Scripted edit sequence receives an additional protocol/verification turn. |
| create-reference.test.js | Reference-to-publish script runs out of model replies. |
| create-reference.test.js | Repair/publish journey script runs out of model replies. |
| create-review-fixes.test.js | Expected unconditional success; actual result says browser verification unavailable. |
| create-tier5.test.js | Expected bare stopped message; actual message includes the unverified-build warning. |
| mcp-build.test.js | Exact fixture string includes the newer engineering execution plan. |
| web.test.js | Expected feature prose; actual agent result reports no tested interaction. |

These remain blockers to claiming a green full suite. Completion gates have not been
weakened. The separate failing responsive-builder-chat CI assertion was investigated
and fixed by extracting the exact nutrition function AST range; its former source
slice accidentally included the adjacent account-removal function. Focused reproduction
passes after the test fix; production deletion behavior is unchanged.

## Still experimental or unverified

- Actual Mem0 service/model/vector persistence and semantic retrieval quality.
- Ruflo task execution, swarms, learning/memory operations and all host hooks.
- AutoHarness reflector models, promoter and active-skill lifecycle.
- Understand-Anything dashboard, semantic analysis and auto-update hooks.
- Real-model time to first token, vision comprehension, model quality and production
  latency. Shortened request deadlines are not measured speed gains.
- A live connection to an independently operated Browser Use service. The wired
  dependency is Kairoq's guarded browser-session contract, not an automatic bridge
  to an arbitrary Browser Use server.
- The user's calorie app camera actions: actual project URL/source is still needed.
- Full final-suite/hosted CI success, production deployment and live customer QA.

The screenshot fix proves image routing and payload retention. It does not prove that
the sample camera button in a pasted transcript is wired or that body measurements can
be inferred from a photo. Do not enable the optional integrations or claim those app
features are implemented without their separate runtime evidence.

## Follow-up: bulk scaffold writes

The agent protocol now prefers one `write_files` action for a cohesive scaffold,
splitting only when the response limit requires it. Adjacent independent write actions
are coalesced before the eight-tool limit; read/edit/delete and overlapping-file
boundaries keep their order. This fixes silent loss of independent writes beyond the
old action limit as well as avoiding repeated static checks within one response.

`test/batch-scaffold.test.js`: **2 passed, 0 failed/skipped**. Fifteen independent
writes become one action with every file retained. An actual agent run writes three
modules in one file batch, builds them with Vite, and proves a counter click in Chrome.
It uses two scripted model replies (write/test, then finish); no live model speed claim.
The controlled test took 5.4 seconds overall on this machine.

CI on initial PR commit 28fa546: 15 workflows completed successfully, including the
new Node 22/24 modular stack workflow; broad benchmark was still running at inspection.
Follow-up commit CI must be checked separately.
