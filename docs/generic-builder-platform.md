# Generic builder platform

This release expands the shared app runtime and the AI planning contract. These capabilities apply to generated apps across industries rather than a travel-specific template.

## Implemented capabilities

- Managed authentication sessions persist across server restarts; logout revokes the stored session. Session tokens are stored as hashes.
- Team workspaces with owner/admin/member/viewer roles, per-collection read/create/update/delete permissions, role-restricted state transitions, membership revocation and audit history. Private collections stay private within team apps.
- Declarative transactional server functions: read/list/create/update/delete, guarded actions, assertions, arithmetic, comparisons, boolean conditions, concatenation and aggregates. Functions use actual records, enforce the same permissions and schema rules, reject inaccessible linked records, roll back failed transactions and replay matching request IDs.
- Generated function inputs can select accessible records through dropdowns. Trusted browser components render team management, function forms, schedules, webhook connections and billing controls.
- Scheduled jobs persist their inputs, due times, leases, retry attempts and execution history. Every run rechecks the account and team permissions. Recovered executions reuse the original run key.
- Signed webhook receivers verify the raw request body and timestamp, reject expired/tampered events, bind execution to a configured integration account and deduplicate event IDs. Scripts and unsigned user-supplied callbacks cannot gain privileged execution.
- Stripe-hosted payment/subscription checkout uses a server-owned Price and tenant binding. Signed Stripe events reconcile subscription state against the Stripe API. Checkout redirects alone never mark a payment as paid. Missing connections are shown as setup requirements.
- OpenAPI/Swagger and Postman imports allow up to 2 MB and 1,000 operations. Postman preserves collection/folder URL variables, inherited auth, JSON/form bodies and saved response examples. Credential values are omitted. Pre-request scripts, unsupported encodings and unresolved authentication are rejected for execution.
- OAuth client credentials support body authentication, Basic header authentication and the explicitly configured legacy base64 credential variant. Generated workflows can bind an operator-configured OAuth provider.
- Large API contracts retain the complete import while bounding the model's planning context to relevant operations. No omitted operation is invented.
- Generated server functions require acceptance scenarios. Fixture records and expected business outcomes execute during build/repair QA, before publication. Valid-input scenarios submit through the visible generated function form and verify its rendered result; invalid-input scenarios also exercise server validation through HTTP. Shared workspace controls use compact disclosures and the reusable field/button styles. Managed text contrast checks account for text-fill colors and unintended ancestor dimming.
- Additive revisions preserve stored field types, collection scope, permissions, function input/role contracts and configured automation/billing definitions. Named maps and JSON Schema input properties normalize into the same validated field contract. Planning retries include the rejected output and exact error. Server function steps may be repaired; new capabilities may be added. Acceptance failures trigger bounded server-logic replanning while preserving the existing fixtures, inputs and expected results.
- Standalone exports include the new backend modules and automation worker, without users, production data or secrets.

## Configuration

Teams, server functions, automations and billing use the managed SQLite backend. The optional Supabase backend continues to support private CRUD; advanced schemas are rejected there rather than silently running with missing permissions.

Scheduled jobs are opt-in and execute approximately every 15 seconds when due; each account is limited to 100 active jobs. Function queries are bounded to 1,000 records and programs to 30 steps. This runtime executes declarative programs, not arbitrary JavaScript or SQL.

Webhook configuration requires KAIROQ_WEBHOOK_SECRET_<APP>_<NAME> and KAIROQ_WEBHOOK_OWNER_<APP>_<NAME>. The owner is the registered app user ID. One configured receiver per named integration prevents replay across unrelated user bindings. Generic signatures use t=<unix_seconds>,v1=<HMAC_SHA256(timestamp + '.' + raw_body)>; Stripe signatures use Stripe-Signature. Timestamp tolerance is five minutes.

Stripe configuration requires KAIROQ_BILLING_LIVE_ENABLED=true, KAIROQ_PUBLIC_URL, KAIROQ_STRIPE_SECRET_<APP>, KAIROQ_STRIPE_PRICE_<APP> and KAIROQ_STRIPE_WEBHOOK_<APP>. Provider keys belong only in server secret storage. Real payment verification requires a connected Stripe account; controlled transport tests are not evidence of a live charge.

API execution retains host/operation allowlists and separate provider-write controls. KAIROQ_API_OAUTH_PROVIDER_<APP> selects an operator-configured provider. API credentials and target configuration are never browser overrides.

## Verification boundaries

The final complete local suite passed 247 tests with zero failures and zero skips, including business repair and payment reconciliation hardening. The browser journey exercises team creation, real record persistence, transactional stock reservation, rejection of overselling, acceptance scenarios, scheduled-job setup/cancellation, workspace isolation, selection persistence and logout. Billing tests use a controlled transport and signed event logic; no real Stripe charge or Sabre booking is claimed.

The local generation/visual-review fixtures test orchestration mechanics. They do not establish real AI design quality by themselves. Real generated-app evidence is recorded separately after the release is deployed.

This is a concrete expansion of Atlas's generic builder. It does not establish complete Lovable parity, unrestricted provider support or unattended production reliability for every possible application. Google/Microsoft app SSO, binary uploads, real-time collaborative editing, arbitrary server extensions and provider-specific workflows beyond the documented supported contract remain separate capabilities.

## Provider references

- https://schema.postman.com/collection/json/v2.1.0/draft-04/collection.json
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/events/manage-webhook-endpoints
- https://developer.sabre.com/guide/rest-apis-token-credentials/rest-apis-token-credentials
