# Native Figma connection

Kairoq treats Figma as a first-class design connection rather than a generic app integration.

## User flow

1. Open **Connectors → Figma**.
2. Press **Connect Figma**.
3. Authorize Kairoq in Figma once.
4. Paste a Figma frame link.
5. Kairoq reads the selected frame and uses it as design evidence for the build.

The normal customer flow does not require a personal access token.

## OAuth configuration

Set these server variables:

- `KAIROQ_OAUTH_FIGMA_CLIENT_ID`
- `KAIROQ_OAUTH_FIGMA_CLIENT_SECRET`
- `KAIROQ_PUBLIC_URL`

Register this redirect URL in the Figma OAuth app:

`<KAIROQ_PUBLIC_URL>/api/create/oauth/callback`

Requested scopes:

- `current_user:read`
- `file_content:read`

Kairoq uses PKCE and stores access/refresh tokens encrypted in the project's secret store. Tokens are never returned to browser JavaScript.

## What Kairoq reads

For the selected frame, Kairoq can use:

- layer hierarchy
- dimensions and auto-layout
- spacing and padding
- fills, gradients, borders, radii and shadows
- typography and text
- image fills
- component names
- component-set names
- style names

The rendered frame can also be attached as visual evidence when the build tier supports image input.

## Security boundary

The first release keeps the Figma connection owner-scoped. Project editors cannot use the owner's OAuth identity to inspect arbitrary Figma files.

If team-level Figma access is added later, each collaborator should connect their own Figma account.

## Existing reverse flow

Kairoq's existing **Send to Figma** flow remains separate. It captures the built Kairoq page as editable layers and hands it to the Kairoq Figma plugin.

This gives Kairoq both directions:

**Figma → Kairoq build**

and

**Kairoq app → Figma editable layers**
