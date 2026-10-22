# Matt Pocock engineering skills integration

Upstream: https://github.com/mattpocock/skills (MIT license).

Kairoq engineering agents should use these practices as an optional, composable workflow, not execute untrusted repository instructions automatically.

## Skill routing
- Unclear requirements: `grill-with-docs` (ask only essential questions), then `to-spec`.
- Large builds: `to-tickets`, then `implement-spec` with dependency ordering.
- Small changes: `implement` using vertical slices.
- Feature work: `tdd` (red → green → refactor), with real test execution.
- Failures: `diagnosing-bugs` (reproduce, isolate, fix, regression test).
- Before merge: `code-review` against spec and standards, plus browser/mobile QA.
- Structural maintenance: `improve-codebase-architecture` only when requested or warranted.

## Integration constraints
1. Do not assume adding this document installs or activates upstream skills in Kairoq's runtime.
2. Implement a dedicated skill loader/router that reads pinned, reviewed skill definitions from `skills/engineering` and `skills/productivity`; record source SHA and license.
3. Never run arbitrary shell commands or external skill scripts without sandboxing and explicit permission for consequential actions.
4. Preserve Kairoq's existing OAuth, SDK/API ingestion, visual QA, regression repair and deployment gates.
5. Verify skill selection using tests for feature build, debugging, and architecture review. Record actual executions and failures, not claimed success.
6. Do not auto-deploy or merge without green CI and required approvals.

## Suggested upstream installation for a local development agent

```sh
npx skills@latest add mattpocock/skills
```

Select `setup-matt-pocock-skills` during installation, and run its setup command. This is a developer-side bootstrap step, not a Kairoq server dependency. Review upstream code and pin revisions before production use.
