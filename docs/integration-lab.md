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
