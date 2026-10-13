# Kairoq Create

`/create` is a chat builder for React apps, similar to Lovable. Customers describe an app, Kairoq writes a React + Vite + Tailwind project, shows it in a live preview, applies follow-up changes through chat, and publishes it in one click.

## How it works

1. **Chat edits.** Each message sends the current source files and recent chat to the builder model (`callBuilderModel`, which uses the same model order and budget as the existing builder). The model returns only the files it changed.
2. **Checks before building.** File paths must be under `src/`. Imports are limited to project files and `react`, `react-dom`, `lucide-react` and `react-router-dom`. `import.meta`, query imports (`?raw`), absolute paths and CSS `@import`/`url()` pointing at local files are rejected, so generated code cannot pull server files into a build.
3. **Server-side Vite build.** Accepted changes are built with Vite and Tailwind in a temporary folder (about 1–2 seconds). If the checks or the build fail, the error is sent back to the model and it retries, up to 3 attempts in total.
4. **Versions.** Every successful edit is saved as an immutable version (`versions/<n>/files.json` and `versions/<n>/dist`). Any version can be previewed or restored.
5. **Preview.** `/builder/p/<id>-<key>/v/<n>/` serves a version's build. The key is random per project. Pages served from the Kairoq host use a CSP sandbox, so generated code runs in an isolated origin and cannot use the Kairoq session.

## Publishing and domains

- **Publish** makes a version live at `/sites/<name>/` on the Kairoq host. Publishing again moves it to the current version.
- **Subdomains (optional):** set `KAIROQ_SITES_DOMAIN=sites.example.com`, point wildcard DNS `*.sites.example.com` at Kairoq, and add the wildcard domain in Railway. Published apps are then also served at `<name>.sites.example.com`.
- **Custom domains:** the customer adds a domain. Kairoq shows two DNS records: a `CNAME` to Kairoq and a `TXT` record at `_kairoq.<domain>` that proves ownership. After **Verify** succeeds, requests for that host serve the published app.
- **HTTPS for custom domains:** Railway issues certificates only for domains added to the service. Add each verified custom domain in Railway (Settings → Networking → Custom Domain) until this is automated through the Railway API.

## Accounts and credits

- Customers sign up at `/create` with email and password. Passwords are hashed with scrypt. Sessions are random tokens, stored hashed, in an HttpOnly cookie.
- New accounts get `KAIROQ_FREE_CREDITS` credits (default 30). Each chat edit costs 1 credit, taken when the edit starts and refunded if it fails.
- The owner login (`APP_PASSWORD`) builds without credits. **Set `APP_PASSWORD` in production.** Without it, every visitor counts as the owner.
- `KAIROQ_BUILDER_SIGNUPS=closed` turns off new sign-ups.

### Selling credits with Stripe

1. In Stripe, create a product with one-time Prices for each credit pack.
2. Set `KAIROQ_STRIPE_SECRET_KEY` and `KAIROQ_CREDIT_PACKS`, for example:
   `[{"id":"starter","name":"Starter","credits":100,"price":"price_...","label":"$20"}]`
3. In Stripe, add a webhook endpoint `https://<your-kairoq-host>/api/create/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and set `KAIROQ_STRIPE_WEBHOOK_SECRET` to its signing secret.

Credits are added only after the webhook signature is checked and the Checkout Session is read back from Stripe with `payment_status: paid`. Each session is credited once.

## Storage

| Data | Location |
|---|---|
| Projects, versions, builds | `workspace/react-projects/` (`KAIROQ_REACT_PROJECTS_DIR`) |
| Published names and domains | `workspace/react-projects/hosting.json` |
| Accounts, sessions, credit ledger | `workspace/builder-accounts.sqlite` (`KAIROQ_BUILDER_ACCOUNTS_DB`) |

On Railway, `workspace/` should be on the persistent volume.

## Limits

- Up to 80 source files, 200 KB per file and 1.5 MB per project.
- Builds run one at a time and time out after 90 seconds.
- Generated apps have no backend. They keep data in the browser. Connecting the existing full-stack runtime (login, database, Stripe) to Create projects is the next step.
