# Figma Connection

Kairoq treats Figma as a first-class design source.

## Customer flow

1. Open **Connections → Figma** or press **Figma** from the composer.
2. Press **Connect Figma**.
3. Approve the requested Figma scopes in the browser.
4. Paste a Figma frame link, or paste the link directly into normal Kairoq chat.
5. Kairoq reads the selected frame and uses observed design evidence before implementation.

The normal customer flow never asks for a personal access token.

## What Kairoq reads

For a selected frame Kairoq reads:
- layer hierarchy and dimensions;
- auto-layout, spacing, radii, borders, shadows and fills;
- text, fonts and typography;
- image fills;
- component metadata;
- component-set metadata;
- styles exposed with the selected node.

Imported image fills are saved as project uploads so the build can reuse the actual design assets.

## OAuth

Create a Figma OAuth app and register:

```
https://<your-kairoq-origin>/api/create/oauth/callback
```

Set these Railway variables:

```
KAIROQ_OAUTH_FIGMA_CLIENT_ID
KAIROQ_OAUTH_FIGMA_CLIENT_SECRET
KAIROQ_PUBLIC_URL
APP_ENCRYPTION_KEY
```

Scopes requested by Kairoq v1:

```
current_user:read
file_content:read
file_metadata:read
library_content:read
```

Kairoq uses Authorization Code + PKCE. OAuth access/refresh tokens are encrypted server-side through the existing project secret store and are never returned to the browser.

## Why Variables are not requested in v1

Kairoq intentionally does not request `file_variables:read` in the first release. The ordinary file/node response already provides frame content and component/style metadata. Figma's Variables REST API has stricter plan requirements, so Variables can be added later as an optional capability rather than making the base connection unusable for more customers.

## Agent behavior

A request containing a Figma design URL is automatically routed to Agent Mode.

Agent Mode exposes:

```json
{"tool":"inspect_figma","url":"https://www.figma.com/design/...?..."}
```

The tool:
- requires the project's connected Figma account;
- reads the frame before UI code is written;
- returns observed layer/component/style evidence;
- saves imported image fills into `./uploads/`;
- never guesses that a Figma file was inspected if the connection is missing.

## Kairoq → Figma

The existing **Send to Figma** workflow remains available separately. It captures a built Kairoq page and reconstructs it as editable Figma frames through the Kairoq Figma plugin.

So the two directions are:

- **Figma → Kairoq:** OAuth-backed design inspection and build.
- **Kairoq → Figma:** existing editable-layer export plugin.

## Public launch

A private OAuth app can be used for internal testing within its associated Figma team/organization.

For general Kairoq customers, configure the app as public and complete Figma's OAuth app review before treating the connection as publicly available.

## Verification

The focused Figma CI checks:
- OAuth scopes and PKCE;
- encrypted token exchange;
- current refresh endpoint plus legacy fallback;
- Bearer-auth API reads;
- component/style evidence;
- UI has Connect/Disconnect and no normal PAT field;
- Figma URLs route to Agent Mode;
- Agent protocol advertises `inspect_figma`;
- capability registry routes Figma requests correctly.
