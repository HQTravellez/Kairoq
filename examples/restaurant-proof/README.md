# Restaurant verification proof — Kairoq

An isolated, **working demonstration**, not a claim that the production Kairoq AI builder can autonomously reproduce it.

## Start

```bash
node examples/restaurant-proof/server.js
# http://localhost:4177
```

Requires Node 22+, no new npm dependencies. Optional environment variables:

- `PORT=4177`
- `RESTAURANT_DB=/tmp/kairoq-restaurant-test.json` (default is an untracked JSON file beside server.js)
- `RESTAURANT_ADMIN_TOKEN=<private-token>` (required to read bookings as admin)

Run the functional tests with:

```bash
node --test examples/restaurant-proof/restaurant.test.js
```

**What the tests assert:** real HTTP page and slot responses; unauthorized reads rejected; booking POST returns 201; a physical JSON row is persisted and can be fetched with an admin token; duplicate table+time is rejected with 409; invalid fields receive 400.

**Not yet verified:** third-party photo loads in a real browser; browser-generated screenshot evidence; full mobile interactions; automatic AI creation or repair of this app. These require an isolated headless-browser execution job and an independent builder generation run. Do not advertise as autonomous/production ready until those pass.

The sample restaurant, prices, names, and photo usage are illustrative. Reservations are test-only with no restaurant connection. No payment or transactional email. This JSON persistence mechanism is not multi-replica production safe; a production restaurant should use Postgres and a unique inventory constraint, timezone-aware availability, proper authentication and rate limiting.

## Acceptance journey for Kairoq

1. Ask Kairoq to build this application from the prompt below, without copying source files.
2. Capture source commit, model selection, API usage, and test environment.
3. Run HTTP test; fail if the database cannot be read back.
4. Use Playwright or a real-browser agent to verify images load and decode, submit a reservation via the UI, and verify its persistence.
5. Re-run after an AI repair to prove no regression.
6. Publish only when the previous steps pass with reproducible evidence.

### Canonical build prompt

> Build an elegant, responsive fictional Italian restaurant website named Oliva with a seasonal sample menu, a licensed food photograph, and reservations for parties of 1–8. The reservation submission must persist in a test database, prevent double-booking the same time slot, and appear in an authenticated admin listing. Test browser images, mobile layout, booking submission, and database persistence. Do not call it complete until tests pass. Use fake customer information only.

### Safety
This is a test-only demonstration, not a live reservation system. Do not store real visitor PII or expose admin token in client-side code.