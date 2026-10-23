# Optional CDM (ScaleDown) and Jev decision lab

This lab is NOT integrated with user-facing Kairoq builds and never operates on customer records.
It is designed to measure context compression and fast typed decisions against test fixtures,
without replacing the coding agent or the existing deterministic release checks.

## ScaleDown: constrained decoding / context optimization
- Official endpoint: POST https://api.scaledown.xyz/compress/raw/
- Set SCALEDOWN_API_KEY only in an isolated runner.
- Evaluate compressToolOutput(publicFixture, question), compare size reduction and exact-fact retention against the original.
- Never send protected source, secrets, user data, system instructions or security-critical evidence.
- Every compressed result is informational; re-read full tool output before writing code based on detailed contracts.
- Do not claim real savings or accuracy without side-by-side measured runs.

## Jev: typed decision layer
- Official endpoint: POST https://api.typesafe.ai/v1/systemone
- Set TYPESAFE_API_KEY only in an isolated runner.
- classifyFailure(publicFailureLog) asks the model for one of auth, api, database, visual, test, build, other
  plus a human-review likelihood. The result is advisory; it cannot execute fixes, approve deployments or bypass access control.
- Ambiguous results, confidence below 0.8, human-review probability >=0.6, provider failure or invalid response route to review.
- Compare against a manually labeled dataset before using classification to suggest targeted Kairoq repair specialists.
- Provider keys are optional and are not present in build artifacts.

## Tests
Run node --test test/decision-layer.test.js. These are mocked provider-contract tests only.
A real-provider test requires separate approval, credentials, privacy review, cost accounting and opt-in.
Reference: https://docs.scaledown.ai/quickstart and https://docs.typesafe.ai/introduction/quickstart

`integration-lab/decision-layer.js` has no deployment or side-effect logic. No release
gate or permission decision may depend on a model output without deterministic verification.
