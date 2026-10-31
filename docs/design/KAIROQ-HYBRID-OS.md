# Kairoq Builder Workspace Redesign

Status: implementation blueprint for the current Kairoq redesign.

## Direction

Kairoq should feel like a modern AI app builder: simple, calm and product-first.

The interface should prioritize:
- the user's objective
- the live build conversation
- build progress and evidence
- the working preview
- clear revision and deploy actions

The UI itself should stay quiet.

## Visual system

### Canvas
- white main canvas
- soft gray navigation and secondary surfaces
- near-black primary text
- muted gray secondary text
- subtle neutral borders
- one restrained indigo accent where interaction state needs emphasis

### Avoid
- black/neon hacker styling
- Matrix styling
- space or sci-fi motifs
- decorative gradients
- glowing cards
- gaming-dashboard visuals
- fake terminal theatre
- excessive KPI tiles
- rounded-card-on-rounded-card layouts

### Typography
Use Geist for product UI.
Use mono only for code, IDs, logs, raw model identifiers and technical evidence.

### Shape
Use small-to-medium radii.
Not every region needs a card.
Prefer whitespace and separators over containers.

## Main shell

### Sidebar
Keep navigation familiar and compact.
Active state should be a soft neutral fill, not a bright branded block.

### Top bar
Only show what is relevant to current context:
- current page/project
- model/cost state when useful
- simple/advanced density toggle
- settings/profile

### Simple vs advanced
These are not visual themes.

Simple:
- fewer controls
- edited evidence
- default for most users

Advanced:
- denser controls
- raw IDs and technical metadata
- logs/evidence when relevant

Both use the same light visual system.

## Home

The home screen should answer one question:
**What do you want Kairoq to do?**

Keep:
- primary prompt
- Ask / Web app / Mobile app intent choices
- useful recent work

Avoid turning Home into an operations dashboard.

## Build an App

This is the primary product experience.

Structure:
**Objective → Execution → Preview**

### Objective
The user's requested outcome is primary.
Website / Web App / Interactive are immediate choices.
Project name, data backend, API docs, assets and deployment options are secondary behind Build options.

### Execution
Expose real work as a compact stage line:

**Understand → Design → Build → Verify → Repair → Ready**

States must come from observed builder/job state.
Do not invent percentage progress unless the backend provides a real percentage.

### Preview
Keep the working product visible as much as possible.
Desktop/mobile controls should be compact.
QA state should be factual and secondary to the preview itself.

## Project workspace

Default structure:
- conversation/objective on the left
- preview/code/data in the main area

Architecture, evidence and logs can be tabs/drawers rather than permanent columns.

## Models

Model presentation must remain factual:
- name
- provider
- FREE / LOCAL / PAID / AGENT
- relevant capability
- availability

Do not invent benchmark scores.

## Skills and connections

Prefer simple lists/modules over marketplace-style cards.
Show what is active, what it does and what is connected.

## Deploy

Use a clean preflight:
- build state
- browser QA
- regression checks
- security checks
- version
- target

Then deploy.

After deployment show:
- public URL
- exact version
- verification state
- rollback

## Error and repair states

Every failure should explain:
1. what failed
2. what Kairoq observed
3. what it is trying next
4. whether the user must act

Never style queued or unverified work as success.

## Motion

Keep motion almost invisible:
- short opacity/transform transitions
- no constant decorative animation
- respect reduced motion

## Implementation order

### Slice 1 — shared shell
- light visual system
- sidebar/top bar
- chat/composer
- simple/advanced density modes

### Slice 2 — Build experience
- Objective → Execution → Preview
- progressive disclosure
- live build stages

### Slice 3 — Project workspace
- preview/code/data/evidence/architecture
- compact quality/deploy state

### Slice 4 — Models / Skills / Connections
- simplify presentation
- preserve factual state

### Slice 5 — Deploy / repair
- preflight
- verification evidence
- rollback

### Slice 6 — visual QA
- desktop browser verification
- mobile browser verification
- screenshot review
- accessibility/focus checks
- regression fixes

## Non-negotiables

- Keep the interface simple.
- Do not copy another product's branding or decorative identity.
- Do not reintroduce Space OS, Matrix, neon or hacker aesthetics.
- Do not claim model/tool/deploy states that are not observed.
- Do not sacrifice clarity for atmosphere.
- Preserve existing Kairoq orchestration, build, verification and release behavior unless a change is explicitly required.
