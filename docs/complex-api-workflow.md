# Complex supplier API workflows — Kairoq proof

**Status:** isolated proof, not a finished Trip Ninja integration. No production server imports this module and no live calls have been made.

## Why a general OpenAPI SDK is insufficient

Real integrations contain interdependent calls and business rules that one endpoint description does not reveal:

- authentication and refreshing provider tokens, including proprietary flows;
- multi-call state machines with branching/fanout and aggregation across suppliers;
- carrier/offer/booking identifiers and transformations between different API schemas;
- rate limits and safe retries; write operations (booking, ticketing, cancellation) must not be repeated blindly;
- mock, sandbox, and certification tests of actual provider-specific responses.

Kairoq already has `api-learning.js`, `api-docs.js`, `api-sdk.js`, `api-validation.js`, `api-adapter.js`, and OAuth support. This PR adds the missing **cross-provider orchestration layer** in `api-workflow.js`.

## What is implemented

- Declarative `call` and bounded `fanout` workflow steps.
- Multiple independently imported named OpenAPI/Postman plans: e.g., `tripninja`, `sabre`, `atlas`.
- Explicit routing maps from content-source labels to **allowlisted operation IDs**. Model-generated text cannot select arbitrary endpoints.
- Safe references such as `{\"$ref\":\"steps.queries.trip_id\"}` and `{\"$ref\":\"item.search\"}` with no code evaluation and no access to `process.env`.
- Per-operation validation against documented request schema and 2xx response schema when available.
- Explicit approval of **every POST, PUT, PATCH, DELETE, OPTIONS**, including POST searches. The caller must inject an executor; by default this engine cannot send HTTP requests at all.
- Bounded fanout and overall operation count; blocked duplicate result IDs, unknown supplier routes, large response bodies and suspicious prototype fields.
- Minimal trace recording only step, provider, operation ID and result status, not request headers, credentials or fare bodies.
- Optional `liveInvoker` intentionally reuses Kairoq's existing `api-adapter.execute` host allowlists, DNS pinning, live gates, credential policy and write controls. It is **not** called unless explicitly selected by a trusted caller.

## Mocked Trip-Ninja-style test workflow

```text
Search requested by Travellez
    |
    v
Trip Ninja optimizer: get search/content requirements
    |
    v
Match each content query to approved supplier adapter
    |-- Sabre search ---> normalized fare result
    +-- Atlas search ---> normalized fare result
    |
    v
Aggregate results by query ID
    |
    v
Trip Ninja: generate optimized solutions
    |
    v
Validate response contract, return results
```

`test/api-workflow.test.js` uses entirely **synthetic** OpenAPI contracts and responses, and checks the full sequence plus unauthorized requests, unknown routes, response mismatch, fanout limits and secret-safe tracing. **Its `getSearches`/`generateSolutions` field names and fare schema are illustrative**; they are not assertions about Trip Ninja's production JSON contract.

Trip Ninja currently publishes SmartFlights documentation: https://devhub.tripninja.io/smartflights/overview/. Older FareStructure documentation is in the deprecated section. Choose the product and schema currently enabled on the Travellez account, then replace these fixtures with **actual version-pinned provider documents**.

Trip Ninja also publishes a Python SDK and .NET SDK for provider-specific protocol handling. These are not CDM services. Any provider-required binary or compressed message format should be implemented from official SDKs or formal specifications, not guessed by a model.

## Commands

```sh
npm ci
node --test test/api-workflow.test.js test/api-learning.test.js test/api-integration.test.js test/api-oauth-sdk.test.js
```

To execute the isolated mock example, open `test/api-workflow.test.js`; all four calls are intercepted by a local stub.

## What still needs to be completed for Travellez

1. Obtain current **SmartFlights** contract, provider SDK usage, authentication/sandbox test credentials, test fixtures, and certification guidance through the authorized Trip Ninja account. Do not commit credentials.
2. Import real supplier contracts for whichever Sabre/Atlas/NDC content sources Travellez is permitted to use; verify semantic field mappings with real sample payloads.
3. Add dedicated secure token bootstrap/refresh for Trip Ninja's exact current auth variant. Generic static-token support does not prove that this is implemented.
4. Implement the documented provider-specific content compression/wrapping step where required. **Do not confuse Trip Ninja's SDK compression with ScaleDown CDM context compression.**
5. Add persistent workflow state, bounded read retries, idempotency/correlation IDs, rate limiting, and per-tenant authorization.
6. Test end to end against the **supplier sandbox**; explicitly gate chargeable bookings, PNR creation, ticketing, changes and cancellations. Do not claim booking readiness from mock fare searches.
7. Verify desktop/mobile UI, real booking state and release-proof benchmark before a merge or production deployment.

## AI's role and costs

An LLM can parse prose docs, suggest operation dependencies and mappings, generate adapter code, then run and repair tests. The compiled workflow, security permissions, schema validation and supplier results must remain deterministic and auditable. Jev and CDM are optional helpers, not required to run this workflow.

Indicative model-only cost based on published **October 2026** standard prices, ignoring caching and other tools:

| Model | Input per 1M tokens | Output per 1M tokens | Example: 100k input + 20k output |
| --- | ---: | ---: | ---: |
| OpenAI GPT-5.4 mini | $0.75 | $4.50 | **$0.165** |
| Claude Sonnet 4.6 | $3.00 | $15.00 | **$0.60** |

A real complex integration can involve many model calls and repeated debugging, so the example **is not a fixed per-integration quote**. Kairoq's server hosting, execution, testing, partner access, SDK licensing and supplier transaction fees are additional. Trip Ninja's public pricing lists percentage-of-total-transaction-value or revenue-sharing options without a fixed public percentage.

Sources: https://openai.com/index/introducing-gpt-5-4-mini-and-nano/ ; https://platform.claude.com/docs/en/about-claude/pricing ; https://tripninja.io/pricing
