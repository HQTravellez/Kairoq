# Taste Skill — Kairoq integration plan

Source: https://github.com/Leonxlnx/taste-skill (MIT licensed). Skill: `design-taste-frontend`.

## Intended behavior
For UI creation, redesign, landing pages, dashboards and app screens, route to Taste Skill as a design-specialist step alongside Kairoq's existing engineering router. Start with the product brief and design constraints; develop a distinct art direction; use properly licensed/attributed imagery; inspect rendered pages at desktop, tablet and mobile widths; review screenshots and repair the most consequential issues. Preserve Kairoq's existing functional and accessibility checks.

## Production requirements
- Review and pin the upstream revision; copy the approved skill definition into a sandboxed skill registry rather than executing remote installer scripts on the server.
- Node 22+ and Chrome/Chromium required for its browser inspection scripts. Network image search must be gated and attribution retained.
- Make visual QA a bounded loop (up to three rounds) with screenshot evidence and recorded scores; no fabricated passes.
- Run in a dedicated resource-limited worker, since upstream estimates substantial token usage and 30–45 minute builds.
- Add tests for routing landing pages, dashboards, mobile UI and redesign requests; add end-to-end browser validation before enabling deployment.
- Do not treat this documentation as installed or active runtime support.

## Developer-side install reference
`npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`
