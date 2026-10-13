# Kairoq Create

`/create` is a chat builder for React apps, similar to Lovable. Customers describe an app, Kairoq writes a React + Vite + Tailwind project, shows it in a live preview, applies follow-up changes through chat, and publishes it in one click.

## How it works

1. **Chat edits.** Each message sends the current source files and recent chat to the builder model (`callBuilderModel`, which uses the same model order and budget as the existing builder). The model returns only the files it changed.
2. **Checks before building.** File paths must be under `src/`. Imports are limited to project files and `react`, `react-dom`, `lucide-react` and `react-router-dom`. `import.meta`, query imports (`?raw`), absolute paths and CSS `@import`/`url()` pointing at local files are rejected, so generated code cannot pull server files into a build.
3. **Server-side Vite build.** Accepted changes are built with Vite and Tailwind in a temporary folder (about 1–2 seconds). If the checks or the build fail, the error is sent back to the model and it retries, up to 3 attempts in total.
4. **Versions.** Every successful edit is saved as an immutable version (`versions/<n>/files.json` and `versions/<n>/dist`). Any version can be previewed or restored.
5. **Preview.** `/builder/p/<id>-<key>/v/<n>/` serves a version's build. The key is random per project. Pages served from the Kairoq host use a CSP sandbox, so generated code runs in an isolated origin and cannot use the Kairoq session.

## Editor features

- **Live streaming.** The model's output streams into the chat as it is written: the summary, the file being written, and its latest code. The editor uses Server-Sent Events (`/api/create/jobs/<id>/events`) and falls back to polling.
- **Runtime checks and Fix it.**
  - Every build includes a small reporter script (`builder-runtime/kairoq-reporter.js`). It tells the editor about uncaught errors, console errors, failed requests and blank pages.
  - After each build, the server also opens the app in headless Chromium (`runtime-check.js`). If it finds problems, they go back to the model. These retries count toward the 3 attempts.
  - If the last attempt still has problems, the version is saved with them, and the editor shows **Fix it**.
- **Model tiers.**
  - **Standard** uses the builder model chain.
  - **Pro** uses `KAIROQ_PRO_MODELS` first, then the standard paid chain.
  - Messages with images and the Standard tier use `KAIROQ_VISION_MODELS`, because DeepSeek cannot read images.
  - Pro and image requests need `KAIROQ_BUILDER_PAID_APPROVED=true` and count toward the builder budget.
- **Discuss mode.** The model answers or plans without changing code or creating a version. An **Implement this plan** button sends the plan as a build request.
- **Images in chat.** Attach, paste or drop up to 4 images (PNG/JPEG/WebP/GIF, 3 MB each).
  - Images are shown to the model as reference, for example "build this screenshot".
  - In build mode, images are also saved as project uploads. Every build copies them to `./uploads/<name>`, so the app can use your logo and photos.
- **Credits per message:** Standard `KAIROQ_STANDARD_CREDITS` (1), Pro `KAIROQ_PRO_CREDITS` (5), Discuss `KAIROQ_DISCUSS_CREDITS` (1), plus `KAIROQ_IMAGE_CREDITS` (1) when images are attached. Credits are refunded when a message fails.

## Visual edits

**Edit** turns on click-to-select in the preview. Builds tag every JSX element with `data-kq="file:line:col"` (`react-visual.js`).

- Selecting an element shows its text, Tailwind classes and, for images, `src` and `alt`. There are quick text and background colour swatches.
- **Apply** rewrites that element in the source and builds a new version. There's no AI call and no credit.
- Text or classes set by code (expressions) can't be edited visually. The panel says so and suggests asking the AI.

## Code download and GitHub

- **Settings → Download code** gives a ZIP of a standard Vite + React + Tailwind project (`npm install && npm run dev`). Its `src/kairoq.js` keeps using the app's backend on Kairoq.
- **Push to GitHub:**
  - Commits the current version to `owner/repo`, creating a private repo if needed.
  - Uses the customer's fine-grained token (stored encrypted), or the server `GITHUB_TOKEN` for the owner.
  - Files Kairoq doesn't manage, like `.github/`, are kept.
- **Pull from GitHub:** brings `src/` changes back as a new version, after the same safety checks and build.

## Automatic HTTPS for custom domains

With `RAILWAY_API_TOKEN` (or `RAILWAY_PROJECT_TOKEN`) set:

- Adding a domain also registers it on this Railway service (`customDomainCreate`).
- Kairoq shows Railway's DNS records alongside the `_kairoq` TXT record. Railway issues the certificate once DNS is correct.
- Removing the domain, or deleting the project, removes it from Railway.

Without a token, add each verified domain in Railway by hand. If the API call fails, the error is shown on the domain.

## Backend for generated apps

Every Create project has its own backend: user accounts and saved records in a per-project SQLite database (`workspace/react-projects/<id>/data.sqlite`). Generated code uses it through the built-in `kairoq` module:

```js
import { auth, collection } from 'kairoq';
await auth.signUp(email, password);           // also signIn, signOut, user(), onChange(fn)
const tasks = collection('tasks');
await tasks.create({ title: 'Book the venue' });
const mine = await tasks.list({ mine: true }); // also get, update, remove, where, order, limit
```

Collections must be declared in `src/backend.json`, which the model writes along with the app:

```json
{ "collections": { "tasks": { "access": "private" }, "messages": { "access": "public" } } }
```

| Access | Read | Add | Change or delete |
|---|---|---|---|
| `private` | the signed-in creator only | signed-in users | creator |
| `shared` | any signed-in user | signed-in users | creator |
| `public-read` | anyone | signed-in users | creator |
| `public` | anyone | anyone | creator (anonymous records: owner only, from the Data tab) |

- The API is `/api/apps/<project-id>/…`. It uses bearer tokens instead of cookies, so it works from sandboxed previews, `/sites/` pages and custom domains. A custom domain can reach only its own app's API.
- Passwords are hashed with scrypt. Records are limited to 20 KB, 10,000 per collection and 10,000 users per app. Each IP is limited to 240 requests per minute per app.
- Preview and published versions share one database. The access rules come from the published version, or from the current draft if the app isn't published.
- In the editor, the **Data** tab shows collections, records and sign-ups, and lets the owner delete records.
- In sandboxed pages (preview and `/sites/`), sign-ins last until the page reloads because browser storage is unavailable. On subdomains and custom domains, sign-ins persist.

### Optional backend features

Enable these in `src/backend.json`. The model adds them when the app needs them.

- **File uploads.** Add `"storage":{"access":"signed-in"}` (or `"public"`).
  - In code: `storage.upload(file)` returns `{id, url}`.
  - Allowed: images, PDF, text and CSV, up to 5 MB each, with `KAIROQ_APP_STORAGE_MB` per app (default 500).
  - Files are served with a sandbox CSP. Only the uploader can delete a file.
- **Email.** Add `"email":true`.
  - In code: `email.send({to:'owner'|'me', subject, text})`.
  - Mail goes only to the app owner (the Create account's email, or `KAIROQ_OWNER_EMAIL` for owner-built apps) or to the signed-in user. Apps can't be used to spam other people.
  - Limits: anonymous senders 5 per hour, signed-in users 20 per hour, 200 per app per day.
  - Sent through Resend (`KAIROQ_RESEND_API_KEY`, `KAIROQ_EMAIL_FROM`).
- **Payments.** Add `"payments":{"products":{"pro":{"price":"price_…","mode":"payment"|"subscription"}}}`.
  - The app owner connects their own Stripe secret key and webhook secret under **Settings**. Both are encrypted with `APP_ENCRYPTION_KEY`.
  - In code: `payments.checkout('pro')` starts Stripe Checkout for the signed-in user. The return URL must point to the app itself.
  - Purchases are recorded only from a signed webhook, after re-reading the Checkout Session with the owner's key.
  - In code: `payments.has('pro')` / `payments.purchases()`. Payments show in the Data tab.
- **Scheduled jobs.** Add `"schedules":[…]` with `every` set to `hour`, `day` or `week`.
  - Actions: `delete_older_than` (with `days`) and `email_owner_summary`.
  - The server checks for due jobs every 5 minutes.

## Checking real-model quality

`scripts/create-quality-check.js` builds six typical apps with the configured model. It applies a follow-up edit to each, opens every result in Chromium, and reports pass/fail, attempts and timing. It spends real model credit (roughly a few cents per app with DeepSeek).

```
OPENROUTER_API_KEY=... KAIROQ_BUILDER_MODE=paid-first KAIROQ_BUILDER_PAID_APPROVED=true \
  node scripts/create-quality-check.js --limit 6 --out quality-report.json
```

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
- Generated apps can't take payments yet. Stripe checkout inside generated apps is a possible next step.
