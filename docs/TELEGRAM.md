# Kairoq Telegram channel

Telegram is an optional access channel for the same Kairoq customer account and projects.

It is not a separate agent. Messages are sent through Kairoq's normal project/job engine, so model selection, memory, capability routing, verification and response rules stay the same as the web app.

## Setup

1. Create a bot with **@BotFather**.
2. Add these variables to the Kairoq service:
   - `KAIROQ_TELEGRAM_BOT_TOKEN`
   - `KAIROQ_TELEGRAM_BOT_USERNAME` (without `@`)
   - `KAIROQ_TELEGRAM_WEBHOOK_SECRET` (random letters/numbers/`_`/`-`)
   - `KAIROQ_PUBLIC_URL` (the public HTTPS Kairoq origin)
3. Redeploy Kairoq.
4. On startup, Kairoq registers:
   - webhook: `<KAIROQ_PUBLIC_URL>/api/telegram/webhook`
   - allowed update: `message`
   - Telegram webhook secret header validation

## Customer pairing

A customer signs in to Kairoq once and chooses **Telegram** in the sidebar.

Kairoq creates a short-lived one-time token and opens:

`https://t.me/<bot>?start=<token>`

The user presses **Start** in Telegram. That private Telegram chat becomes linked to the existing Kairoq account.

The pairing token:
- expires after 15 minutes;
- works once;
- is not a login password;
- is removed after successful pairing.

The raw Telegram chat ID is not stored in channel state. Kairoq stores a one-way hash for lookup.

## After pairing

The user can simply message Kairoq from Telegram.

Supported commands:
- `projects`
- `switch 2`
- `new`
- `open`
- `publish`
- `undo`
- `credits`
- `help`

Ordinary text is treated as a Kairoq request for the current project.

`open` sends a separate one-time 15-minute editor sign-in URL, so the user does not need to enter a password just to open the full editor.

## Security

- only private Telegram chats are accepted by the Kairoq project channel;
- incoming webhooks must include the configured Telegram secret-token header;
- unpaired chats cannot read or change Kairoq projects;
- pairing is account-specific and replaces an older Telegram pairing for the same account;
- no Telegram bot token is exposed to the browser;
- project actions still use Kairoq's normal execution and verification gates.

## Existing generic Telegram integration

The repository also has an older generic Telegram/Atlas channel under `/api/channels/telegram/webhook`.

The customer Kairoq channel is deliberately separate and uses the `KAIROQ_TELEGRAM_*` variables plus `/api/telegram/webhook`, so a generic background-agent bot cannot silently become an authenticated customer project channel.
