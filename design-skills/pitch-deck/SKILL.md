---
name: Pitch deck
description: Investor and partner pitch decks in the browser with keyboard navigation, a classic ten-slide story and print to PDF one slide per page.
group: Page types
---
# Pitch deck

A pitch deck tells a short, confident story: the problem, your answer, why now, proof it works and what you are asking for. Small businesses use it for investors, banks, landlords, franchise partners, sponsors or a corporate client. Each slide makes one point.

## Purpose
- A `Deck` component that renders slides from an array (type, title, body, data, image, notes). Content and numbers (market size, traction, the amount asked) come from data the owner edits; never type figures into JSX.
- Slides are 16:9 at a fixed design size (1920 x 1080 or 1280 x 720) and scale to fit the window with a transform wrapper, so text never reflows.

## Story (about ten slides)
1. Cover: logo, one-line description, round or purpose, presenter and date.
2. Problem: one big sentence and 2-3 supporting facts.
3. Solution: what you do, in plain words, with a product or venue image.
4. Why now: the shift that makes this the right moment.
5. Product or offer: screenshots or photos in device or frame mock-ups, with 3 callouts.
6. Market: three nested circles or stacked bars for total, serviceable and reachable market, with sources.
7. Traction: a bar or line chart with one large highlighted number and growth rate.
8. Business model: how money is made, unit economics in a small table.
9. Go to market: channels and next milestones on a simple timeline.
10. Team: photos, names, roles, one relevant credential each.
11. The ask: amount and use of funds as a horizontal stacked bar with labels.
12. Thank you: contact details and QR code.

## Layout and type
- Generous margins (96 px at 1920), a 12-column grid, titles top left at 64-80 px semibold, body at 32-40 px. Max 30 words of body per slide.
- A small footer on every slide: logo, section name, slide number "07 / 12".
- Big numbers at 160-240 px with tabular figures for key metrics.
- Palette: a dark or white base, one brand colour for emphasis, greys for secondary data. Sans like Inter, Manrope or Space Grotesk; optional serif for the cover.

## Navigation
- Keyboard: ArrowRight, Space, PageDown next; ArrowLeft, PageUp previous; Home, End; number keys optional. Sync with the URL hash (`#/5`).
- Click areas on the left and right thirds, swipe on touch, a hidden toolbar on mouse move with prev, next, overview grid (all slides as thumbnails) and fullscreen (`requestFullscreen`).
- Presenter notes toggled with N in a side panel.
- Transitions: short fade (200 ms), off for reduced motion.

## Print to PDF
- `@page { size: 1920px 1080px; margin: 0 }` (or 1280px 720px). In `@media print`, render all slides stacked, remove the scale transform, set each slide `break-after: page`, hide the toolbar and notes, and keep colours with `print-color-adjust: exact`.
- Charts use `isAnimationActive={false}` so they appear in the PDF.

## Avoid
- Dense bullet lists, more than one idea per slide, tiny chart labels, inconsistent title positions, stock photos of handshakes, unsourced market numbers, and amounts typed directly in the layout.
