---
name: Diagrams that explain
description: How-it-works steps, process flows, timelines, customer journeys, funnels, decision flowcharts, before/after and cycles, drawn as clean inline SVG or Tailwind in the app's own colours. Use when a section explains a sequence, a process or a choice.
group: Page types
---
# Diagrams that explain

Adapted for Kairoq from diagram-design by Cathryn Lavery (MIT License, Copyright (c) 2025 Cathryn Lavery, github.com/cathrynlavery/diagram-design): its editorial rules, rewritten for React, Tailwind and the app's design tokens.

## First: should this be a diagram?
- Draw only when a visitor learns more from the picture than from a sentence or a list. A list of features is a list; a single step is a sentence; attributes side by side are a table.
- The best move is usually deletion. Every box is one distinct idea (two boxes that always go together are one box). Every line carries information; when the layout already shows the order, leave the line out.
- Target density: calm. At most 7 steps or boxes, 9 for a flowchart. More than that is two diagrams: an overview and a detail.

## Pick the type
| Showing | Use |
|---|---|
| What happens after you book / order / sign up (3 to 5 steps) | **Steps**: numbered row on desktop, vertical list on phones |
| Who does what, with handoffs (you, us, the courier) | **Swimlane**: one row per actor, steps in columns |
| A choice with branches ("Not sure which plan?") | **Flowchart**: questions as rounded boxes, answers on the lines |
| Events in time (our story, project phases, a day at the retreat) | **Timeline**: one axis, dated markers, short labels |
| How a customer moves from first visit to regular | **Journey**: stages left to right, what they do and what they get under each |
| Drop-off or narrowing (applications → interviews → offers) | **Funnel**: stacked bars that narrow, numbers inside |
| A repeating cycle (subscribe → receive → enjoy → renew) | **Loop**: 3 to 5 nodes on a circle, arrows one way |
| Before and after | **Two columns** with the same rows, the change marked in the accent colour |

## Look
- Use the app's own tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`/`text-primary` (from src/index.css). Never a separate palette.
- The accent goes on 1 or 2 focal elements only (the step that matters, the recommended answer). Everything else is foreground and muted. If four things are accented, nothing is.
- Boxes: 1px `border-border`, radius 6 to 10px (`rounded-md`/`rounded-lg`), no shadows, no glow, no gradients. Vary emphasis by weight and size, not by giving every box a different colour.
- Numbers for steps in a small circle or as large light numerals; names in the body font at semibold; a short muted line under each name (one sentence, under 12 words).
- No dark "tech" look with neon lines unless the whole app is designed that way.

## Lines and arrows (inline SVG)
- Straight when both ends line up; otherwise right-angle elbows with a small rounded corner. No diagonal lines.
- One attach point per line on each box edge; never stack two lines on top of each other; never route a line behind a box it does not connect.
- Arrow labels: very short (one or two words), on a small background rectangle so the line does not run through the text, with a little gap from the line.
- Default lines in the muted colour, the main path in the accent colour, optional or "later" paths dashed (`strokeDasharray="5 4"`).
- Draw lines first and boxes on top, so lines never cover text.

## Build it in React
- Prefer Tailwind layout (flex/grid) for steps, timelines, journeys, funnels and two-column comparisons: it stays responsive and accessible. Use inline `<svg>` only for the connecting lines, a loop or a flowchart.
- SVG: a `viewBox` with `className="w-full h-auto"`, colours through `currentColor` or `stroke="hsl(var(--primary))"` style tokens, text as real `<text>` with the app's font. Keep sizes on a 4px grid.
- Phones: horizontal flows become vertical (`flex-col md:flex-row`); a wide SVG gets a simpler vertical version below `md` rather than shrinking unreadably.
- Accessibility: wrap in `<figure>` with a `<figcaption>`; give the SVG `role="img"` and an `aria-label` that says what the diagram shows in one sentence; steps are an `<ol>`.
- Motion is optional: reveal steps one after another on scroll, once, and respect `prefers-reduced-motion`.

## Check before you finish
- Could a table or two sentences say the same? Then use those.
- Can any box or line be removed without losing meaning? Remove it.
- Accent on at most 2 elements; no line crosses text; nothing overlaps at 375px wide.
- Every label uses the business's own words from the page, not invented features.
