# Connected services: Supabase, Crawl4AI, Stirling PDF

Three open-source projects Kairoq can use. Each one is optional. Kairoq works without them, and the
Plugins page shows which are on.

| Service | What it adds | Licence | How it is connected |
|---|---|---|---|
| [Supabase](https://github.com/supabase/supabase) | An app's sign-ups and saved data live in the owner's own Supabase | Apache-2.0 | Per app, by the app owner: builder → Settings → Database |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Reads script-heavy websites as clean text when someone shares a link | Apache-2.0 | Server: `KAIROQ_CRAWL4AI_URL` |
| [Stirling PDF](https://github.com/Stirling-Tools/Stirling-PDF) | PDF tools in the chat's + menu: merge, split, smaller, OCR, pages to images | MIT core (only free features are used) | Server: `KAIROQ_STIRLING_URL` |

## Supabase (per app, no server setup)

1. In Supabase, open the project, press **Connect**, and choose **Session pooler** (port 5432). Copy the
   address and put the database password in place of `[YOUR-PASSWORD]`.
2. In **Project Settings → Database → SSL Configuration**, download the certificate. It is the same
   certificate for every Supabase project.
3. In the Kairoq app builder, open **Settings → Database**, paste both, and press **Connect Supabase**.

The app's tables go into the schema `kairoq_<project id>`, so one Supabase project can hold several
Kairoq apps. Kairoq copies the current data across once. Test copies used by saved checks stay in
Kairoq, never in the owner's database. SQL tables (`db.sql`) stay in Kairoq for now.

Only Supabase addresses are accepted, so the server never connects to an address of the owner's
choosing anywhere else. Kairoq always checks Supabase's certificate and never switches the check off.
A server admin can save every owner pasting the certificate by setting `KAIROQ_SUPABASE_CA` (the PEM
text) or `KAIROQ_SUPABASE_CA_FILE`.

**Disconnect** leaves the data in Supabase and goes back to Kairoq's own copy as it was when Supabase
was connected.

## Crawl4AI (server)

1. In the Kairoq Railway project: **New → Docker Image →** `unclecode/crawl4ai:latest`. Name it `crawl4ai`.
2. Do not give it a public domain. It listens on port 11235.
3. On the Kairoq service, set `KAIROQ_CRAWL4AI_URL=http://crawl4ai.railway.internal:11235`.
4. If you turn on Crawl4AI's own token check, set `KAIROQ_CRAWL4AI_TOKEN` as well.

When a shared page is thin or built by scripts, Kairoq asks Crawl4AI first. Next it tries its own
Chromium reader, and last the public Jina reader. With Crawl4AI on, pages no longer go to Jina.

## Stirling PDF (server)

1. In the Kairoq Railway project: **New → Docker Image →** `stirlingtools/stirling-pdf:latest`. Name it
   `stirling-pdf`.
2. Do not give it a public domain. It listens on port 8080.
3. On the Kairoq service, set `KAIROQ_STIRLING_URL=http://stirling-pdf.railway.internal:8080`.
4. If you turn on Stirling's login, create an API key there and set `KAIROQ_STIRLING_API_KEY`.

Files go from the browser to Kairoq, then to Stirling PDF, then straight back. Nothing is stored.
Each request takes at most 10 files and 40 MB.

## Ideas taken, not code

The following go into the product plan as features to build in Kairoq's own way:

- **OpenHands:** the task checklist that ticks off as the agent works.
- **Langflow:** a drag-and-drop board for automations.
- **Maxun:** point-and-click picking of data on a page.
- **Dify:** knowledge bases for app assistants.

Their code is not used. Dify's licence forbids running it as a multi-user online service without
written permission, and Maxun's AGPL licence would require publishing Kairoq's own code.
