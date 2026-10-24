# CI assertion investigation — 2026-10-23

Status: DONE_WITH_CONCERNS (broader baseline failures remain).

Symptom: responsive-builder-chat failed its nutrition isolation assertion on main.
Root cause: the string slice from ownerClearNutritionRecords to ownerDelete also
included ownerRemoveAppUser, which legitimately deletes a user. Confirmed by the
CI job log and a reproduction on the original source.
Fix: use Babel's function declaration boundaries for the assertion. The test still
fails if DELETE FROM users appears inside the nutrition function. Production deletion
behavior is unchanged. Focused tests pass after the fix.

Broader full-suite failures reproduce on pristine de948bdd and are recorded separately
in docs/agent-stack-evidence.md; do not weaken browser completion gates to satisfy old
scripted model expectations.
