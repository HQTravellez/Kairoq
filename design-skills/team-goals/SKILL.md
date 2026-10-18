---
name: Team goals tracker
description: Goal and OKR trackers showing quarterly objectives, measurable key results, progress bars, owners, status and check-in history.
group: Page types
---
# Team goals tracker

Goals only help when everyone can see them and see progress. This page turns a few objectives into a clear, honest picture: where we are, who owns what, what is at risk. It fits a small hotel group, a restaurant team, an agency or any shop with a few people.

## Purpose
- Data model: period (quarter or month), theme, objectives (title, description, owner), key results (title, start value, target value, current value, unit, owner, status, due date), and check-ins (date, value, note, author).
- Progress per key result is computed as (current - start) / (target - start), clamped 0-100; objective progress is the average of its key results. Status is set manually (On track, At risk, Off track, Done) or suggested from expected progress by date.

## Layout
- Period banner: "Q4 goals", theme sentence, days left in the period with a thin timeline bar showing today's position, and overall progress.
- Objectives as columns on desktop (`grid lg:grid-cols-3 gap-6`) or stacked cards on phones. Each objective card: number, title, owner avatar, progress ring, then its key results.
- Key result row: title, a progress bar (`h-2 rounded-full`) with a marker for expected progress today, current / target value with units in tabular numbers, owner avatar and a status pill (soft green, amber, red, grey).
- Side summary ("This quarter at a glance"): count by status, biggest mover this week, items with no check-in for 14 days, and next review date.
- Check-in dialog: update value, choose status, add a short note; history shows as a small timeline under the key result with a sparkline of values.
- Filters: owner, status, team.

## Palette and type
- Clean, neutral base with brand colour for progress fills; status colours used only on pills and the expected-progress gap.
- Sans (Inter, Manrope) with clear hierarchy: objective titles semibold text-lg, key results text-sm.

## Details
- Keep 3-5 objectives and 2-4 key results each; warn softly in the editor when more are added.
- Show units properly (%, guests, reviews, currency via `Intl.NumberFormat`); never hard-code values.
- Celebrate done key results with a subtle check animation.
- Print view for a review meeting: one page with all objectives, no navigation.
- Empty state invites creating the first objective with a short example.

## Avoid
- Traffic-light colouring of whole cards, vanity percentages without values, gamified leaderboards between colleagues, hidden owners, and progress that cannot be explained by a number.
