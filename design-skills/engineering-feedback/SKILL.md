---
name: Engineering feedback loops
default: on
group: engineering
description: Small verified changes, reproducible bug diagnosis, behavior-oriented tests and review; adapted from mattpocock/skills (MIT).
---
# Engineering feedback loops for Kairoq
Source: https://github.com/mattpocock/skills
License: MIT. Adapted reference, not the entire upstream plugin or its commands.

Use for application development, debugging, testing and code review. Keep requirements and architecture decisions explicit and concise.

## Before implementation
- Understand the user's goal and existing code before editing. Resolve only genuinely blocking ambiguities; otherwise make small, reversible assumptions.
- Identify public behavior, dependencies, constraints and the smallest useful end-to-end vertical slice.
- Preserve existing interfaces and names unless a migration is explicitly needed.

## Test-driven vertical slices
- Prefer tests at observable boundaries (HTTP, public module API, real browser, real build).
- For regressions, reproduce the reported symptom with a failing test or reliable minimal script before fixing.
- Make the smallest code change that passes the test, then refactor while preserving the signal.
- Do not write tautological tests, rely only on mocked success paths or confuse compilation with a working product.
- Run focused tests during development, then relevant integration, build, and broader regression checks before release.

## Diagnosis and verification
- Capture the actual failure and reduce it to a deterministic feedback loop.
- Form and test hypotheses one at a time; inspect logs and relevant code instead of guessing.
- Redact secrets from logs, screenshots and evidence; use environment-based credentials.
- For UI changes, use desktop/mobile browser evidence, interactions and console errors.
- Report passed, failed, skipped, unverified and blocked checks separately. Never describe unrun vendor integrations as verified.

## Delivery
- Review the diff for correctness, security, compatibility, readability and unintended changes.
- Prefer small commits with clear rationale and traceable test evidence.
- Don't claim a merge, deployment or successful run before it has actually happened.

## Source attribution
Adapted from mattpocock/skills, especially engineering/tdd, diagnosing-bugs and implement, MIT licensed. Upstream agent commands and auxiliary tools are not installed or executed by this skill.
