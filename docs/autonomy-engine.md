# Autonomous API execution engine (development)

Module: `autonomy-engine.js` with `autonomy-store.js`. This is an evidence-first building block, **not** an autonomous general-purpose coding agent.

## Capabilities
- Reuses existing OpenAPI importer, server-side approved-host API adapter and JSON Schema response validator.
- Executes only specifically approved operations. Live calls still need `KAIROQ_API_LIVE_ENABLED=true`, `KAIROQ_API_HOSTS`, and `KAIROQ_API_APPROVED_OPERATIONS`. Writes additionally need specific write approval and `KAIROQ_API_WRITE_ENABLED=true`.
- Bounded transient retries for GET/HEAD, no automatic write retries.
- Produces privacy-reduced hashed evidence, saves append-only per-project memory on a configurable persistent volume.
- Generates existing backend and SDK artifacts (generation **does not imply** a working integration).
- Allows candidate skills; skill promotions require independent comparative benchmark data.

## Missing before launch
These modules are not wired to the authenticated HTTP routes or the user interface. No real provider API was called. No autonomous design, browser QA, programming-agent repair, benchmark runner or production deployment is included. Benchmark scores supplied to `promoteSkill` must be independently measured and access-controlled in the integration layer; do not expose the function directly to untrusted callers. Add tenancy checks, operational audit logging, encrypted credential storage, data-retention policy, remote execution worker and UI before production.

Local tests: `node --test test/autonomy-engine.test.js`. Runtime: Node 22+.
