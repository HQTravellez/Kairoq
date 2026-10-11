# Atlas product orchestration

Builds remain local drafts. The builder never automatically writes to GitHub or publishes a release. Use the existing explicit GitHub and launch actions after reviewing the draft.

## Connected build path

1. Import formal API documentation from a permitted URL or uploaded OpenAPI JSON.
2. Ask the coding model for a requirement map, database schema and ordered provider workflows.
3. Validate the plan against supported runtime capabilities and documented operations and response fields. Retry invalid plans at most three times.
4. Generate the interface using the exact planned schema. Inject tested login, database and workflow components.
5. Run real Chromium auth, CRUD, navigation, persistence and responsive checks, followed by the existing screenshot review and repair gates.
6. Save an immutable version containing the UI, schema, scenario plan and API contract. Export a standalone Node backend with the same workflow routes.
7. Report missing configuration, unsupported requirements and unverified provider scenarios. Publishing rejects unresolved required dependencies. Model/provider fixtures cannot count as live-provider verification.

## Runtime routes

All routes are relative to a generated app's `api/` URL and use its signed-in user's HttpOnly session.

| Route | Behavior |
|---|---|
| GET `workflows` | Workflow forms, documented step IDs and current connection requirements |
| POST `workflows/{workflow_id}/runs` | `{inputs,mode,requestId,confirmWrites}`; mode defaults to `simulate` |
| GET `workflow-runs/{run_id}` | Only the initiating user's stored run |

Simulation validates user inputs and returns a labelled execution plan. It performs no provider requests and creates no records. It does not invent upstream response data.

Live execution preflights every operation's host, credential and policy before the first request. Ordered steps map user inputs using `{"$input":"destination"}` and documented earlier results using `{"$step":"search.quote.id"}`. Optional equality conditions skip steps. Missing mappings fail rather than using fabricated values. Nested schemas validate supported JSON types, required fields, arrays, options and bounds. Unresolved references fail; regular-expression patterns and other unsupported schema keywords are not enforced.

Successful workflow results can create a declared collection record owned by the signed-in user. They cannot bypass guarded local workflow states. Raw provider response credentials are redacted from client results and execution history.

## Credentials and execution policies

No provider credential is needed to plan or build. Each app receives a dedicated `KAIROQ_API_TOKEN_<APP_ID_IN_UPPERCASE>` credential name in its build report and export `.env.example`. Static token, Basic and supported header-key authentication use the existing adapter. OAuth session choreography, SOAP/XML and additional provider-specific headers need a separate adapter.

Live requests require `KAIROQ_API_LIVE_ENABLED=true`, `KAIROQ_API_HOSTS` and explicit `KAIROQ_API_APPROVED_OPERATIONS`. Non-GET/HEAD operations additionally require `KAIROQ_API_WRITE_ENABLED=true`, `KAIROQ_API_APPROVED_WRITES` and confirmation from the signed-in user. Provider POST searches are subject to this rule too.

Run IDs are unique per user and workflow. Reusing the same request ID returns the existing run; changing inputs with that ID is rejected. Concurrent submissions cannot dispatch duplicate requests. Network uncertainty or a partially successful provider sequence is stored as `needs_review`. There is no automatic replay, write retry, invented rollback or compensating provider operation. Reconcile the provider outcome before deliberately starting a new run.

Execution history is stored in `workspace/<app-id>/workflows.sqlite`. Persist the workspace volume. Exports omit user data, sessions, execution history and secrets. A process interruption leaves a running run reserved; it must be reconciled rather than repeated automatically.

## Current boundaries

This is a bounded orchestrator for managed business apps and documented JSON APIs. It is not a guarantee that arbitrary requirements, every API, or any production application can be built from one prompt. Multi-user roles, tenant administration, payment business rules, scheduled jobs and arbitrary generated server code are not supplied by this runtime. Required unsupported features are reported and prevent a ready release. Provider business errors, sandbox access and production behavior still require real integration testing.

Local automated proof uses fixture model/provider responses and real Chromium, HTTP routes and SQLite persistence. It checks scenario validation, nested mappings, UI wiring, private records, export, failure handling, concurrent deduplication and release blocking. Fixture visual verdicts only test the screenshot-review contract; they do not independently establish design quality. No live Sabre or TripNinja bookings are part of those tests.

## Suggested merge order

1. Scenario planning and schema validation (`product-orchestrator.js`, `api-learning.js`, `api-validation.js`).
2. Workflow execution and immutable manifests (`app-workflows.js`, `app-runtime.js`).
3. Trusted workflow UI and build wiring (`app-workflow-components.js`, browser runtimes, `app-builder.js`).
4. Studio inputs, source export and release checks (`server.js`, Build Studio, portability, release, tests).

These modules depend on each other; evaluate each change locally and merge the complete tested set before deploying the new workflow.
