# Kairoq Hybrid OS Redesign Blueprint

Status: implementation blueprint for the Kairoq product shell  
Direction: **Space OS** by default + **Operator Console** for advanced execution  
Principle: the platform should feel like an autonomous product studio, not a generic SaaS dashboard.

## 1. Product identity

### Space OS
The default experience for founders, operators and non-technical builders.

Visual thesis: **quiet mission control**. Deep-space surfaces, precise telemetry, restrained luminous accents and strong editorial hierarchy. It should feel futuristic without becoming cyberpunk or game UI.

Signature move: a subtle orbital/system-map language appears only around important states — starting work, active execution, verification, deployment and project health.

Density: balanced. Home and creation surfaces breathe; execution and project surfaces become denser.

Motion: slow, purposeful system motion. Progress travels along paths; status rings resolve; panels do not bounce.

### Operator Console
Advanced mode for technical users and deep inspection.

Visual thesis: **modern DOS/terminal discipline**, not a retro costume.

Signature move: mono typography, square geometry, scanline texture, command-prefix labels, green/amber operational status, dense evidence and logs.

Use it for:
- agent execution
- project graph / architecture
- logs
- test evidence
- model routing
- API calls
- deployment and rollback
- debugging

Do not turn ordinary customer-facing creation screens into terminal UIs.

## 2. Shared design system

### Space OS tokens
- canvas: #070a12
- elevated canvas: #0b1020
- panel: #0d1322
- elevated panel: #11192b
- border: #202d46
- primary text: #eef4ff
- secondary text: #91a0b8
- cyan signal: #6ee7ff
- blue signal: #7c8cff
- violet intelligence: #a78bfa
- mint success: #72f1b8
- amber attention: #f6c76e
- red failure: #ff7b86

### Type
- Product/UI: Geist
- Operational evidence / IDs / logs: JetBrains Mono
- Avoid decorative display fonts in the platform shell.

### Shape
- Space OS: 9–14px radii, used selectively.
- Operator: 2–3px radii.
- Never round every container.

### Depth
Use three levels only:
1. canvas
2. panel
3. floating command/dialog

Avoid repeated shadows. Most separation comes from tone and thin borders.

## 3. Navigation architecture

### Left rail
Keep Kairoq's existing information architecture but visually group it into:

**CREATE**
- New chat
- Build an app
- Studio

**OPERATE**
- Your work
- Workflows
- Watchers
- Sales

**INTELLIGENCE**
- Memory
- Connections
- Plugins
- Specialists
- Capabilities

**SYSTEM**
- Models
- Security
- API & OAuth
- Settings

Recent conversations/projects occupy the flexible middle region.

### Top command bar
The top bar is the current-context layer:
- current surface/project
- current engine/model
- FREE / LOCAL / PAID status
- Space OS ↔ Operator switch
- global command/search
- settings/profile

The mode switch must be visible but secondary.

## 4. Home / Mission Overview

The current Home becomes **Mission Overview**.

Hero:
- one confident question: "What should we get done?"
- no large decorative dashboard before the user acts
- subtle orbital visual behind/adjacent to hero, not a full-page animation
- Ask / Web app / Mobile app remain as task modes

Below hero:
- "Needs you" first
- Active missions
- Recently completed
- Systems connected

Metrics should be contextual, not generic KPI cards.

Replace equal four-card rows with:
- one prominent attention panel
- one compact running-work column
- one thin system-status strip

## 5. Chat / Ask Kairoq

Chat should feel like an intelligent operating surface.

### Conversation
- assistant responses remain editorial and readable
- user messages are compact system capsules
- tool activity/evidence collapses into a distinct telemetry block
- sources, files and verification are visually separate from prose

### Composer
One strong command surface:
- prompt
- mode
- model/engine
- attachment
- send

Show active capabilities only when useful. Do not permanently crowd the composer with every possible control.

### Active work
When Kairoq is executing, show a small mission timeline above the composer:
Understand → Plan → Build → Verify → Repair → Complete

Only current and failed stages need emphasis.

## 6. Build an App

This is a primary hero surface and must feel substantially better than a form.

### Entry state
Replace ordinary form-first UI with:
- large outcome prompt
- three starter paths: Website / Web app / Mobile
- optional structured controls revealed after intent exists

### During build
Three functional zones:
1. **Objective** — what is being built
2. **Execution** — current task/stage/evidence
3. **Preview** — live product

Do not show all configuration up front.

### Build progress
Use mission language only where it improves comprehension:
- Understanding
- Structuring
- Designing
- Building
- Verifying
- Repairing
- Ready

Avoid theatrical copy such as "engaging warp drive."

## 7. Project Workspace

The project workspace becomes the core **System View**.

Default layout:
- left: project conversation/objectives
- center: live preview/code/data depending selected view
- optional right telemetry drawer rather than a permanently cramped three-column layout

Top project bar:
- project name
- status
- version
- quality
- deploy state
- Preview / Code / Data / Architecture / Evidence

### Architecture
Archify/project_graph becomes a first-class Architecture tab:
- source-backed map
- selected node inspector
- change delta
- impact path
- explicit distinction between source graph and runtime evidence

## 8. Execution / Telemetry

This is where Operator Console becomes valuable.

A task can expand into:
- steps
- tools called
- model/engine
- elapsed work
- affected files
- tests
- browser checks
- screenshots
- blockers
- repair attempts

Space OS shows an edited summary.
Operator Console shows the detailed ledger.

## 9. Models

Models should feel like **engines**, but labels must remain factual.

Every model shows:
- model name
- FREE / LOCAL / PAID / AGENT
- provider
- best for
- speed class
- context availability when known
- current availability

Do not invent quality scores.

Default picker:
- Recommended
- Fast free
- Best free
- Coding
- Reasoning
- Vision
- Premium

Operator view can reveal raw provider/model IDs and routing fallback.

## 10. Skills / Specialists

Skills are **capability modules**, not app-store cards.

Each module shows:
- capability
- scope
- source
- built-in / imported
- active / available
- when it triggers
- evidence requirement where relevant

Scientific specialist skills remain hidden unless task-relevant.

## 11. Connections / Plugins

Show integrations as a system map, not a logo wall.

Groups:
- Connected
- Available
- Needs attention

Each connected system exposes:
- purpose
- permissions/scope
- health/status
- last successful use where available

No fake "live" status.

## 12. Studio

Studio gets a more visual Space OS treatment than the rest of the product.

Entry:
- Image
- Video
- Avatar/UGC
- 3D where supported

Use a gallery/workbench composition, not dashboard cards.

## 13. Deploy / Launch

Deployment should feel like a **preflight**, but remain factual.

Preflight:
- build
- browser QA
- saved regression checks
- security checks
- deployment target
- version

Then:
Deploy

After deployment:
- public URL
- exact version
- health verification
- rollback option
- evidence

Operator mode reveals detailed logs and version history.

## 14. Error and repair states

A strong product identity is most visible when things go wrong.

Every failure state answers:
1. what failed
2. what Kairoq observed
3. what it is trying next
4. whether the user must act

Use amber for blocked/needs-user.
Use red only for actual failure.
Never use success styling for queued/unverified states.

## 15. Motion language

Space OS:
- 160–240ms direct interactions
- 300–500ms view transitions
- opacity + transform only
- subtle moving progress paths
- low-amplitude orbital/status motion
- no constant background movement in work surfaces

Operator:
- nearly instant transitions
- cursor/status blink only where semantically useful
- no decorative terminal typing effects

Always respect reduced motion.

## 16. Component strategy

Create/standardize:
- OSPanel
- CommandBar
- MissionTimeline
- SystemStatus
- EvidenceBlock
- EngineBadge
- CapabilityModule
- ArchitectureMap shell
- PreflightCheck
- OperatorTable
- EmptyMission
- FailureDiagnostic

Existing components should be restyled/reused before introducing new primitives.

## 17. Implementation order

### Slice 1 — shared shell
- Space OS tokens/surfaces
- Operator mode on existing advanced-mode switch
- sidebar/top bar/composer/home shell
- mode naming and accessibility

### Slice 2 — Build experience
- redesign Build an app entry
- progressive disclosure
- execution timeline
- stronger preview framing

### Slice 3 — Project System View
- preview/code/data/evidence/architecture tabs
- telemetry drawer
- quality and deploy state

### Slice 4 — Models / Skills / Connections
- engine presentation
- capability modules
- connection health

### Slice 5 — Deploy / repair
- preflight
- verification evidence
- rollback
- operator logs

### Slice 6 — visual QA
- desktop + mobile browser evidence
- accessibility
- screenshot review
- fix visual regressions
- only then consider making the theme default for all users

## 18. Non-negotiables

- Do not clone Emergent's Matrix identity.
- Do not make the whole product neon.
- Do not make Space OS a decorative starfield.
- Do not make Operator Console fake-terminal theatre.
- Do not rename technical facts into metaphors that reduce clarity.
- Do not sacrifice readability for atmosphere.
- Do not claim model/tool/deploy states that are not observed.
- Default experience must work for non-technical owners.
- Advanced evidence must remain available to technical users.
