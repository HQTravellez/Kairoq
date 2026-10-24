# Kairoq → Python/Hermes migration

## Architecture
Kairoq remains the existing Node/web application during migration. A private Python 3.14 service installs **the complete MIT-licensed NousResearch/hermes-agent checkout**, pinned by commit in `python/hermes-upstream.json`. The Python gateway calls Hermes' `AIAgent` directly. No copying only fragments of its skills or memory code.

The Node chat service exposes `python/hermes` only when both `KAIROQ_PYTHON_AGENT_URL` and `KAIROQ_PYTHON_AGENT_TOKEN` are set. This is an incremental migration, not yet replacement of Node build/database/media features.

## Configuration
1. Build a **private** service from `Dockerfile.hermes-python`. Do not attach a public domain before authentication, permissions and execution limits are reviewed.
2. Set `KAIROQ_PYTHON_AGENT_TOKEN` (long random secret), `KAIROQ_HERMES_MODEL`, `KAIROQ_HERMES_BASE_URL`, and `KAIROQ_HERMES_API_KEY` in the Python service. Only authorized/verified inference accounts may be used; Hermes code itself does not make inference unlimited/free.
3. Set `KAIROQ_PYTHON_AGENT_URL` to the private internal service address and the **same** `KAIROQ_PYTHON_AGENT_TOKEN` in the Node service.
4. Select the `python/hermes` model in Kairoq after disabling `Free Only` unless the service is proven to use an actually zero-cost eligible model and a corresponding policy update is completed.
5. Confirm authenticated `GET /models` and `POST /chat` calls with one short request, then repeat with browser testing and a saved conversation.

## Permissions
The Python gateway restricts request size, requires a bearer secret and caps Hermes agent iterations. Its configured toolsets must be audited before enabling them for multiple users. Hermes upstream contains powerful terminals, browsers and connectors; running the **full codebase** does not mean enabling unrestricted shell/network access to untrusted users. Per-user and per-workspace isolation, persistent session mapping, safer tool authorizations and cost tracking are required.

## Next engineering gates
- Confirm image build and Python import compatibility against the pinned Hermes revision. (Not completed.)
- Verify exact Hermes AIAgent response shape in a real run. (Not completed.)
- Add bounded streaming, per-user session isolation, persistent memory mapping and cancellation.
- Port project-building and browser QA orchestration from Node to Python only after verified functional parity.
- Run a model-selected chat → generate housing-enquiry tracker → authenticated CRUD → Chromium screenshot → automated repair → deployed preview.
- Preserve MIT notice in distributed products and review any secondary third-party dependency licenses.

**Status**: integration code in development branch, no working deployment or successful integration test is claimed.
