# Direct OpenCode V2 integration

This adapter speaks directly to OpenCode V2's documented session API. There is no Hermes dependency.

Current state: `opencode-v2-client.js` provides health, session creation, model switching, prompts, wait, and message reads. Its route/permission behavior is covered by mocked tests. It is NOT wired into Kairoq's production builder yet, and no model inference or agent end-to-end test has passed.

## Run the OpenCode V2 sidecar
Install OpenCode V2 from the official https://dev.opencode.ai/v2/docs/ instructions (npm: `@opencode/cli`). Run it as a private authenticated server process, accessible only to Kairoq (prefer loopback in the same container or a private service network). Do not expose the API publicly.

Configure Kairoq's server environment:
- `KAIROQ_OPENCODE_V2_URL=http://127.0.0.1:4096`
- `KAIROQ_OPENCODE_V2_TOKEN=<server-auth-token>` (only when the sidecar supports the corresponding bearer auth)
- `KAIROQ_OPENCODE_V2_TRUSTED_REMOTE=true` only for a deliberately approved private remote host.

OpenCode V2 free models require using OpenCode itself, according to the V2 Console docs; this adapter is a direct OpenCode client, not a third-party inference API. Model availability and entitlements must be read from the live connected OpenCode installation. Never assume model names or quotas.

## Remaining integration gates
1. Verify authenticated V2 session API against an installed V2 process and choose a supported authentication mechanism.
2. Create an isolated per-project workspace shared with the OpenCode process and define least-privilege tool policies.
3. Connect `opencode-v2-client` into Kairoq's builder; translate session events, file diffs and errors.
4. Run a sandbox code change, build, desktop/mobile browser verification and repair cycle.
5. Gate activation on these passing checks. Do not substitute the existing V1 `opencode-engine.js` until these pass.
