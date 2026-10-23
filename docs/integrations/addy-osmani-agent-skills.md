# Addy Osmani Agent Skills — Kairoq integration

Source: https://github.com/addyosmani/agent-skills (MIT). Upstream currently documents 25 lifecycle skills including `using-agent-skills`, `interview-me`, `spec-driven-development`, `test-driven-development`, and `code-review-and-quality`.

## Strategy
Integrate with Kairoq's single engineering skill router, not a second always-on router. Upstream explicitly warns against loading `using-agent-skills` when the host already routes skills. Select only the task-relevant skill definitions, preserving supplementary `references/` files.

## Lifecycle
1. Define: clarify underspecified requests and write acceptance criteria.
2. Plan: prepare implementation tasks and dependencies.
3. Build: implement minimal vertical slices with tests.
4. Verify: execute real unit, integration, browser and API checks; preserve command output and evidence.
5. Review: use code-review-and-quality and security checks; identify release blockers.
6. Ship: require green checks and explicit deployment approval.

## Rollout
- Inventory and pin a reviewed upstream revision; retain MIT attribution and referenced checklists.
- Map selected skills to Kairoq's existing app-build, bug-fix, API and UI workflows; de-duplicate overlapping Matt Pocock skills.
- Add an adapter that loads only approved Markdown into agent context and records selection rationale.
- Benchmark complex application builds and regression repair before and after adoption.
- Do not execute unreviewed skill scripts or install the entire pack into production automatically.

This file is an integration plan, not proof of runtime activation or passing tests.
