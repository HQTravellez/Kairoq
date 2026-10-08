# PlanURstay Enquiries — verified Kairoq milestone

Live app: https://kairoq-production.up.railway.app/apps/housing-enquiries/

The frontend in this directory was generated and revised by GPT-6 Luna through Experiential Labs inside Kairoq. It uses the authored, constrained `housing-runtime.js` backend for real accounts, cookie sessions, SQLite persistence and account-scoped CRUD. The model does not execute arbitrary server code.

Kairoq requested a priority selector, badges and filtering after the initial build. Chromium verified that the existing saved enquiry survived this AI revision, then edited its status and priority through the UI and verified the dashboard. Registration, reload persistence, 390px mobile layout and logout protection passed without JavaScript errors. Independent public HTTPS checks passed registration, session cookies, create, dashboard, update, logout/login persistence and deletion of the disposable QA enquiry.

These three files are the tested frontend source snapshot. Live code and database reside in the Railway workspace volume. `housing-builder.js` mounts the app and implements generation/revision verification. `EXPLABS_API_KEY` (or the deployed `EXPlabs_API_Key` alias) stays server-side. `HOUSING_APP_BUILD=true` runs the milestone build if it has not yet passed QA.

This is a focused housing app runtime, not a general arbitrary-backend deployment engine. Accounts are separate from the main Kairoq password. Sessions expire after a day or a server restart; users sign in again and their enquiries remain saved. Password recovery, email verification and shared-team workspaces are not part of this milestone.
