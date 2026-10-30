# FreeLLMAPI internal inference pool

Kairoq can use a separately operated [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) service as its internal free-model pool.

This integration does **not** resell FreeLLMAPI or expose provider keys to Kairoq customers. FreeLLMAPI stays behind Kairoq on a private/internal network and Kairoq talks to its OpenAI-compatible `/v1` API.

## Request flow

```
Kairoq chat / Standard build
        |
        v
FreeLLMAPI /v1
        |
        +-- provider/model routing
        +-- per-provider quota tracking
        +-- failover / cooldown
        +-- configured free-tier keys
        |
        v
If unusable or unavailable
        |
        v
Kairoq's existing fallback chain
```

Explicitly selected paid models and Kairoq Pro/Max are not redirected to FreeLLMAPI.

## Kairoq variables

```env
FREELLMAPI_ENABLED=true
FREELLMAPI_BASE_URL=http://freellmapi.railway.internal:3001/v1
FREELLMAPI_API_KEY=<FreeLLMAPI unified key>
FREELLMAPI_MODEL=auto
FREELLMAPI_CODING_MODEL=auto
FREELLMAPI_TOOL_MODEL=auto
FREELLMAPI_TIMEOUT_MS=180000
FREELLMAPI_BUILDS=on
```

For a public/remote FreeLLMAPI service, Kairoq requires HTTPS. Plain HTTP is accepted only for localhost or a Railway private-network hostname.

## What Kairoq uses it for

- free chat and planning
- classification / JSON work
- a first attempt at Standard app builds
- model discovery for health/visibility

A FreeLLMAPI build response still has to satisfy Kairoq's normal parser, build, browser and verification gates. If it is malformed, unavailable, rate-limited, or otherwise unusable, Kairoq continues to its existing provider chain.

## Provider keys and terms

FreeLLMAPI aggregates free tiers; it does not create provider allowance by itself. Configure only provider accounts/keys whose terms fit your internal business use. Do not share or resell provider keys.

## Railway

Run FreeLLMAPI as a separate service with its own persistent volume and provider keys. Keep it private; Kairoq only needs its private hostname and unified API key. The upstream project documents its own Docker/Railway deployment details.

After both services are configured, Kairoq will automatically prefer the FreeLLMAPI pool for free chat and Standard builds.


## Deterministic unified key on Railway

The Kairoq repo includes `freellmapi-railway/`, a thin wrapper over the official FreeLLMAPI image. It does not fork or modify the upstream application. At boot it waits for FreeLLMAPI to initialize its SQLite settings table and then synchronizes the unified proxy key from:

```env
KAIROQ_FREELLMAPI_UNIFIED_KEY=freellmapi-<48+ hex characters>
```

Use the same secret as Kairoq's:

```env
FREELLMAPI_API_KEY=<same value>
```

This removes the need to expose the FreeLLMAPI dashboard just to copy the generated unified key. The wrapper never prints the key.

Railway service settings:
- Config-as-code: `freellmapi-railway/railway.json`
- Persistent volume: `/app/server/data`
- Private endpoint: e.g. `freellmapi.railway.internal`
- Kairoq base URL: `http://freellmapi.railway.internal:3001/v1`
