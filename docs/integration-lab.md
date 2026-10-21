# Kairoq: OpenCode, Onlook, Hey API and Stagehand trial

This is an isolated experimental branch. It does NOT change Kairoq's existing customer accounts, publishing, generated-app runtime, data access or server.

## What is implemented

- **OpenCode**: already integrated in opencode-engine.js and covered by test/opencode-engine.test.js. This branch adds a real-model six-case comparison against Kairoq's native code writer, using exactly the same prompts. It is opt-in and incurs AI costs.
- **Onlook**: read-only DOM-to-source metadata inspection using Kairoq's data-kq source tags, plus Vite/Next.js compatibility assessment. Onlook's full Next.js editor is NOT embedded.
- **Hey API**: offline generation trial, against validated local OpenAPI documents with remote references forbidden. Requires optional pinned openapi-ts binary. No live API calls, secrets, or generated code execution.
- **Stagehand**: read-only local HTTP preview observation runner, using the separately installed Stagehand v4 SDK and explicit trial model credential. Does not click, send forms or visit public sites.
- **CI**: isolated offline adapter tests, without installing these packages in production.

## Commands

Use npm ci and then node --test test/integration-lab.test.js test/opencode-engine.test.js test/api-learning.test.js.

For the optional same-prompt model comparison, install an OpenCode executable and configure the existing opt-in model provider. Run node scripts/compare-builder-engines.js --approve-model-costs. It exercises all six scenarios and stores a report when KAIROQ_COMPARE_OUT points to an output file. It does NOT independently verify database persistence, authentication, deployments or visual quality.

Install @hey-api/openapi-ts and @browserbasehq/stagehand only inside a sandbox with audited pinned versions. For SDK generation, call heyApiTrial(localSpec, {bin:absoluteBinPath}) from integration-lab/bridges.js. For Stagehand, use stagehandTrial(localPreviewUrl) with KAIROQ_STAGEHAND_TRIAL_KEY, only against ephemeral test data. These are optional trials; unavailable dependencies return unavailable instead of falsely passing.

## Release gating

Before any merge to main or enablement for users, complete all of the following: existing entire CI and Docker suite passes; actual OpenCode binary is tested against the same provider/model; real generated app sign-in and authorization, private row-level data, CRUD, workflows, desktop and mobile QA, screenshot evidence, automatic repair and public deployment are proven; Hey API generated SDK is TypeScript-compiled and mock-server tested; Stagehand produces reproducible gains beyond current guarded Playwright browser tests; Onlook-style inspection demonstrably improves visual edits; all licenses, billing and credential handling are reviewed.

A successful offline unit test is NOT a full-stack production benchmark.

Upstream source references: https://github.com/anomalyco/opencode ; https://github.com/onlook-dev/onlook ; https://github.com/hey-api/hey-api ; https://github.com/browserbase/stagehand.

## Jev and ScaleDown CDM decision/context trial

A separate CommonJS adapter lives at `integration-lab/decision-models.js`, with offline tests at `test/decision-models.test.js`. No production Kairoq modules import it.

- **Jev:** Calls TypeSafe's official `/v1/systemone` endpoint with a `choice` question across five existing specialist handlers: coding, API, design, QA, or discussion. Requires `TYPESAFE_API_KEY`.
- **ScaleDown Classify:** Alternative decision provider using `/v1/scaledown` and `SCALEDOWN_API_KEY`.
- **ScaleDown Compress:** Optional text-only compression of large tool results using `/compress/raw/`. The caller must retain the original source for re-reading.
- **Safety:** Confidence and selected-label probability must both reach 0.82; unknown choices fail closed. High-impact actions never receive authority from a model choice.
- **Privacy:** Experiment inputs must be sanitized. Never transmit customer data or credentials, and never embed vendor keys in generated apps.
- **Costs:** Offline mock tests do not make billable model calls. Actual provider validation requires credentials and explicit paid-usage approval.

### Example in an isolated test harness

```js
const {routeTask,compressToolResult}=require("./integration-lab/decision-models");
const suggestion=await routeTask("Build an API integration for Trip Ninja",{
  provider:"jev",key:process.env.TYPESAFE_API_KEY,action:"read API documentation"
});
if(suggestion.status==="routed") console.log(suggestion.route);
// This NEVER grants authority to deploy or send anything.
```

**Release blocker:** No real provider calls, confidence calibration, cross-model benchmarking, or factual-retention tests have been completed. Do not replace Kairoq's prompt history automatically with compressed context.

Primary references: https://docs.typesafe.ai/introduction/quickstart and https://www.langchain.com/blog/building-long-running-agents-with-scaledown-and-deep-agents
