# Real-model test plan

The automated tests use a scripted model. This plan checks what matters to customers: how good the apps are when real models build them, how Kairoq compares with Lovable, and which tier gives the best value. The runner (`scripts/model-eval.js`) runs the same 12 prompts on every model tier and records the results. You score each app by hand.

## 1. Before you start

On the deployed server (Railway):

| Setting | Value |
|---|---|
| `KAIROQ_PUBLIC_URL` | your Kairoq address, for example `https://kairoq.app` |
| `KAIROQ_BUILDER_PAID_APPROVED` | `true` |
| `KAIROQ_BUILDER_MODEL` | `deepseek/deepseek-v3.2` (Standard) |
| `KAIROQ_PRO_MODELS` | `anthropic/claude-opus-5.5` (check the exact id on openrouter.ai/models) |
| `KAIROQ_MAX_MODELS` | `anthropic/claude-fable-5.1` (check the exact id on openrouter.ai/models) |
| `KAIROQ_DESIGN_MODELS` | Fable's OpenRouter id: Fable writes the design brief and does the Polish review |
| `KAIROQ_BUILDER_MONTHLY_LIMIT_USD` | your test budget, for example `100`. Kairoq stops paid calls at this limit. |
| `APP_ENCRYPTION_KEY` | 32 random characters (needed for the webhook and Stripe cases) |
| `KAIROQ_RESEND_API_KEY`, `KAIROQ_EMAIL_FROM` | optional; needed to see emails from the hotel, spa and webhook cases |

Create a Kairoq account for testing and give it enough credits. As the server owner, run this on the server:
`node -e "require('./builder-accounts').database().prepare('UPDATE accounts SET credits=2000 WHERE email=?').run('you@example.com')"`

On your computer, in a copy of the repository (`npm install` once), with Chrome or Chromium installed for screenshots.

## 2. The 12 test cases

Defined in `scripts/model-eval-prompts.json`. Each case is one prompt plus two follow-up edits, so the test covers building and changing an app.

| Case | What it tests |
|---|---|
| `hotel` | Multi-page site, private booking form, owner email |
| `restaurant` | Time-slot form, staff-only page, updating records |
| `tours` | **SQL tables**, a server function that enforces seat limits, owner reports |
| `guest-app` | **Mobile app** setting, sign-in-gated content, **real-time chat** |
| `spa` | Accounts, Google sign-in, password reset, slot logic, Stripe gift cards |
| `crm` | Kanban board, SQL relations, search, dashboard numbers, CSV export |
| `saas` | Landing page polish, Stripe subscriptions, pricing toggle |
| `dashboard` | Charts (recharts), seeded SQL data, date filters |
| `planner` | **AI inside the app**, saved results, share links |
| `events` | QR code tickets, check-in logic, capacity limit |
| `webhook` | **Server function + secret key + HMAC signature**, timeline |
| `blog` | Markdown, admin editor, image upload, comments |

## 3. Runs, in order of cost

Costs are rough estimates: about 30k input and 8k output tokens per build message. Agent mode makes 5–15 model calls per message. Check spending under OpenRouter → Activity after phase 1 and adjust.

| Phase | Command options | Messages | Approx. cost |
|---|---|---|---|
| 1. Baseline | `--tiers standard,pro --modes build` | 72 | $10–15 |
| 2. Hard cases | `--cases tours,crm,webhook,guest-app --tiers pro,max --modes build,agent` | 48 | $40–60 |
| 3. Best possible | `--cases hotel,spa --tiers max --modes agent` | 6 | $15–25 |

Always try a command without `--yes` first. It prints the plan and the credit estimate:

```
node scripts/model-eval.js --url https://kairoq.app --email you@example.com --password '…' --tiers standard,pro --modes build
node scripts/model-eval.js --url https://kairoq.app --email you@example.com --password '…' --tiers standard,pro --modes build --yes
```

Each run writes `eval-results/<date>/`:
- `summary.md`: an overview table plus totals by tier and mode
- `scoring-sheet.csv`: open it in Google Sheets or Excel
- `shots/`: desktop and phone screenshots of every app

The runner records these measurements for you:
- whether the first build and each follow-up worked
- seconds and credits used
- agent steps
- browser errors when the app was checked
- runtime problems Kairoq found while building
- whether the expected words appear in the app (`expected_found`)
- security scan findings
- the preview link

## 4. Scoring (1–5, by hand)

Open each `preview` link and click through the app. Then fill in the score columns.

| Column | 5 | 3 | 1 |
|---|---|---|---|
| `score_matches_request` | Everything asked for is there | Main parts there, some missing | Different app or mostly missing |
| `score_design` | Looks like a professional site you would pay for | Clean but generic | Broken layout or ugly |
| `score_works` | Every flow works (forms save, sign-in, data shows up) | Main flow works, some broken | Main flow broken |
| `score_mobile` | Great on a phone (see the `-phone.png` shot) | Usable | Broken on a phone |
| `score_edits` | Both follow-ups done well, nothing else broke | One done, or something broke | Neither done |

Write anything notable in `notes`, for example "booking form saved but owner page empty".

## 5. Lovable comparison

Paste the same prompt and the same two follow-ups into Lovable, using one new project per case. Doing the 4 hard cases (`tours`, `crm`, `webhook`, `guest-app`) plus `hotel` and `saas` is enough for a fair picture.

Publish each Lovable app, then list the links in a file, for example `lovable-urls.json`:

```json
{"hotel":"https://casa-azul.lovable.app","saas":"https://ledgerly.lovable.app","crm":"https://….lovable.app"}
```

The automatic judge (next section) screenshots them and scores them the same way as Kairoq's apps. You can also put your own screenshots in a folder as `<case>-desktop.png` and `<case>-phone.png` and pass `--lovable <folder>`. To score by hand instead, use the `lovable_*` columns.

## 5b. Automatic design judge

A strong vision model (Fable is a good choice) looks at every app's desktop and phone screenshots and scores them 1–5 on the rubric's matches-request, design and mobile, plus an overall score. It also lists the concrete problems it sees.
- **Blind scoring.** The judge is not told which builder made which app.
- **What it can't score.** It only sees screenshots, so "works" and "edits" stay yours to score.

Add `--judge` to a run (the OpenRouter key comes from `OPENROUTER_API_KEY`):

```
node scripts/model-eval.js --url https://kairoq.app --email you@example.com --password '…' \
  --cases hotel,saas,crm,tours,webhook,guest-app --tiers pro --modes build \
  --judge --judge-model <Fable's OpenRouter id> --lovable-urls lovable-urls.json --yes
```

To judge an earlier run again without building anything (for example after adding Lovable links), use `npm run eval:judge -- eval-results/<run> --judge-model <id> --lovable-urls lovable-urls.json`.

**Results:**
- **`summary.md`** gains:
  - judge averages per tier
  - a **Kairoq vs Lovable** table per case, with the gap
  - the **most common design problems** in Kairoq apps
- **`judge-notes.md`** has every app's problems and strengths.
- **`scoring-sheet.csv`** gains `judge_*` columns, and Lovable's judge scores pre-fill the `lovable_*` columns.

**Cost.** Each judged app costs roughly $0.03–0.20 on OpenRouter, depending on the model.

**Checking the judge.** Spot-check 10–20 apps yourself: a model judging work like its own can be a little generous. If the judge and you disagree a lot on some cases, trust your scores and send me those cases.

## 6. Reading the results

| Signal | Meaning | Action |
|---|---|---|
| First builds below 90% complete on a tier | The model struggles with Kairoq's JSON format | Check `first_error`, then adjust the prompt or model chain |
| `runtime_errors` or `preview_errors` often above 0 | Apps crash or hit backend errors | Look at the case, then improve the system prompt rules for that feature |
| `expected_found` low but scores fine | The expected words were too strict | Ignore |
| `security_high` above 0 | The model wrote insecure code (keys in the browser, public personal data) | Strengthen the prompt and check the security scan's Fix with AI |
| Agent mode scores clearly higher | Worth its 3× price | Recommend Agent for bigger tasks in the UI |
| Max is not clearly better than Pro | Fable not worth 15 credits | Keep Max hidden, or lower its price |
| Lovable wins on design | Kairoq needs better design defaults | Improve the prompt's design guidance and templates |

**Ready to sell when:**
- 90% or more of first builds complete on Pro
- the average `score_works` is 4 or more on Pro
- the hard cases score within 1 point of Lovable

## 7. After testing

Delete the test projects in the Kairoq home screen when you no longer need them, and set `KAIROQ_BUILDER_MONTHLY_LIMIT_USD` back to your normal budget. Send me `summary.md`, `judge-notes.md` and the filled-in `scoring-sheet.csv`, and I'll turn the most common problems into better design rules, skills and starter components. Then run the same cases again and compare.
