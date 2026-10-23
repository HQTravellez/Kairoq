# Karpathy-inspired engineering guardrails for Kairoq

Upstream: https://github.com/multica-ai/andrej-karpathy-skills (MIT). These guidelines are derived from observations attributed to Andrej Karpathy; the repository is maintained by a third party, not necessarily Karpathy himself.

## Default rules for Kairoq coding agents

1. **Think before coding.** Inspect relevant code and requirements. Explicitly state assumptions and tradeoffs. Ask only when ambiguity blocks a correct decision.
2. **Simplicity first.** Choose the smallest maintainable solution that meets the requirements. Avoid speculative features, unused abstractions and gratuitous configuration.
3. **Surgical changes.** Modify only files and lines necessary for the requested task. Preserve unrelated behavior, comments and formatting. Remove artifacts introduced by the current change.
4. **Goal-driven verification.** Define measurable acceptance criteria before implementation. Reproduce bugs, write regression tests, execute relevant checks, and report actual results rather than claiming unrun tests passed.

## Kairoq-specific constraints

- For API integrations, inspect provider documentation and auth/scopes, then validate real contract behavior with safe fixtures or sandbox endpoints.
- For UI work, retain responsive browser screenshot QA and accessibility checks; coordinate with Taste Skill.
- For failures, record reproduction steps and the smallest fix; never hide a failed gate.
- Keep production deployment and consequential external actions approval-gated.
- Apply the principles as persistent instructions in Kairoq's agent prompt assembly; adding this file alone does not activate them.

## Acceptance criteria for runtime wiring

- Agent receives these rules for coding, bug-fix, UI, and API workflows.
- Tests verify prompt injection and routing do not override safety/deployment gates.
- Diff review checks unrelated file modifications and reports them.
- Benchmark captures before/after defect rates, regression outcomes and execution cost.
