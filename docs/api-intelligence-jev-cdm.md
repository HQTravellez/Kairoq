# Jev + ScaleDown CDM advisory layer for Kairoq's complex API builder

**Status: wired into API Studio, opt-in.** Off by default. With `KAIROQ_API_INTELLIGENCE=on`
plus `TYPESAFE_API_KEY` (Jev) and `SCALEDOWN_API_KEY` (CDM):

- **API Studio → analyze / prepare**: after Kairoq reads the documentation, CDM labels what the
  public documentation is about (authentication, dependencies, mapping, errors) and Jev picks the
  next thing to investigate. Shown under the status line as "AI triage (Jev)". The result is also
  in `blueprint.intelligence` of `/api/developer/api/analyze` and `/prepare`.
- **`POST /api/developer/api/orchestrate`** `{contracts:{name:openapi,…}, workflow, publicDocumentation:[…]}`:
  validated multi-provider call graph, generated server-side SDKs and the same advisory. Nothing is
  executed against a provider.

Only public text is sent (anything that looks like a credential is refused), and AI output never
changes the contract, the plan or permissions. No Trip Ninja live booking and no customer data.

## Architecture

```text
Public, explicitly approved documentation snippets
       |
       +-- Kairoq OpenAPI/Postman parser (contract is source of truth)
       |       +-- Verified operation IDs, auth and JSON request schemas
       |       +-- SDK generator
       |       +-- Declarative multi-provider call/fanout graph
       |
       +-- ScaleDown CDM /classify (optional)
       |       +-- authentication, dependencies, mapping, errors, other
       |       +-- confidence gate; return "review" when unsure
       |
       +-- Jev /v1/systemone (optional)
               +-- typed choice of next *investigation* priority
               +-- confidence and chosen probability gate
       |
       v
Reviewed declarative multi-provider workflow
       |
       +-- Explicit per-operation approval and schema validation
       +-- Injected mock/sandbox executor (zero network by default)
       +-- Existing Kairoq live API adapter gates if manually selected
       v
Test evidence, errors, replayable fixtures (no credential traces)
```

**CDM/Jev are specialists assisting the reasoning/coding engine.** They never replace the model that writes adapters, nor do they confer execution authority. The pipeline presently classifies snippets with ScaleDown CDM; **ScaleDown Extract and full-document compression are not enabled**, because API-specific fact extraction must first prove source-span fidelity. All complex workflows still require real version-pinned contracts or manually reviewed mappings.

## New modules

- `api-intelligence.js`: real vendor request envelopes for ScaleDown `POST https://api.scaledown.xyz/classify` and TypeSafe Jev `POST https://api.typesafe.ai/v1/systemone`. Preset label definitions; both use bounded timeouts, fixed origins, response validation, confidence gates and no raw responses in result objects.
- `api-intelligence-pipeline.js`: contract graph + generated SDK artifacts + (optional) CDM/Jev advisory metadata. `testWorkflow` requires an explicit injected executor. No production use.
- `test/api-intelligence-pipeline.test.js`: real HTTP request JSON shapes intercepted by deterministic mock transports; tests unavailable keys, disclosure gates, schema constraints and baseline parity.
- `.github/workflows/complex-api-workflow.yml`: offline integration tests, including existing API importer/SDK regression.
- `scripts/probe-api-intelligence.js` and manual Actions workflow: optional **genuine** Jev + ScaleDown calls (one request each) on synthetic public test text only. Requires manually checked consent and GitHub secrets, never triggered on push.

## Cost and accuracy — distinguish evidence from estimates

| Component | Price or measurement | Evidence level |
| --- | --- | --- |
| Jev direct | **$0.042 per million input tokens; output free** | Official TypeSafe price, checked 2026-10-21 |
| One Jev call on fixture | **$0.00000462** for 110 simulated input tokens | Arithmetic on *mocked usage*, NOT an invoice |
| 1,000 Jev decisions at 500 input tokens each | **$0.021** | Illustration at direct list price; prompt size may differ |
| ScaleDown CDM Classify | **Unknown** until vendor/account confirms billing | Do not invent a per-token or per-request price |
| OpenAPI importer, SDK, workflow tests | No vendor model call required | Offline Node CI |
| Hosted API, coding-model, sandbox, Trip Ninja transactions | **Additional unknown costs** | Need account contracts + metering |

A completed model trial or token estimate does not prove improvement. In our mocked three-operation synthetic Trip Ninja-style fixture, *both* baseline and optional-CDM/Jev modes returned **the same validated output**. This confirms output parity and fail-closed behaviour, **not** accuracy uplift, reduced coding/debug effort, or vendor inference effectiveness.

**How to prove actual benefit:** get vendor keys into GitHub Actions Secrets (never in Git), run the manually-approved one-shot probe, then evaluate identical independently labelled supplier documentation and error cases against Kairoq without advisers. Measure contract mapping precision/recall, version detection, routing accuracy and abstention, successful SDK compilation, sandbox pass rate, retries, LLM tokens, Jev input usage, CDM billing, p50/p95 latency and total cost per successful integration. For any deployment, test the real current Trip Ninja SmartFlights SDK and authorized GDS/NDC credentials and verify real travel supplier responses.

## Instructions

Offline:

```sh
npm ci
node --test test/api-intelligence-pipeline.test.js test/api-workflow.test.js test/api-learning.test.js test/api-integration.test.js test/api-oauth-sdk.test.js
```

Manual real-provider probe:

1. In repo Settings > Secrets and variables > Actions add `TYPESAFE_API_KEY` and `SCALEDOWN_API_KEY`. These are optional; the normal CI never needs them.
2. Open **Actions > Manual Jev + ScaleDown CDM probe**; check the approval input; run the workflow on this branch.
3. Inspect the redacted `api-intelligence-real-provider-probe` JSON artifact: outcomes, latencies and reported token counts (when the vendors provide usage fields). Nothing prints secret values. If either key is absent, the job reports `blocked-missing-keys` and fails instead of pretending a pass.

Explicit usage from trusted code:

```js
const {prepare,testWorkflow}=require("./api-intelligence-pipeline");
const prepared=await prepare({
  contracts:verifiedOpenApiPlans,
  workflow:reviewedMultiProviderRecipe,
  publicDocumentation:["Synthetic public request and response lifecycle."],
  ai:{enabled:true,allowThirdPartyDisclosure:true}
});
const result=await testWorkflow({
  prepared,contracts:verifiedOpenApiPlans,workflow:reviewedMultiProviderRecipe,
  input:syntheticInput,
  approvedOperations:approvedKeys,
  invoke:approvedMockOrSandboxExecutor
});
```

The `allowThirdPartyDisclosure` flag is required for provider calls; the source text is required to be explicitly public, sanitized and at most 9k bytes per item (up to four). The Jev state is a compact non-secret summary of the validated graph. Production data privacy needs a separate review and opt-in; the basic regex guard is not a full DLP system.

## Blockers before integration is truly automated

1. Real Trip Ninja current API contract and sandbox access, including SDK-specific flight-content payload handling, then read-only live verification.
2. Kairoq coding-agent connection from a reviewed plan to generated supplier-specific code with typed cross-provider mappings.
3. Automatic compile, sandbox schema/fixture tests, failure triage and a bounded repair loop (with approval for changed source and any live writes).
4. Persistence, state transitions, idempotency, rate limiting and secure per-tenant credential isolation.
5. Real vendor model key/access and vendor pricing for ScaleDown. PR can remain draft if keys are absent.
6. Full regression and end-to-end UI/booking/production checks before merge.

Source contracts: https://docs.scaledown.ai/api-reference/classify ; https://docs.typesafe.ai/introduction/quickstart ; https://typesafe.ai/
