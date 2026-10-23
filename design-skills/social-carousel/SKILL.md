---
name: Social carousel
description: Multi-slide 1080x1350 social media carousels with a consistent template, slide counter and one-click export of every slide as an image.
group: Page types
---
# Social carousel

Carousels let a small business tell a short story: five reasons to visit, a recipe in steps, before and after, a new menu, a guide to the neighbourhood. Each slide must work alone, but swiping should feel like turning pages of one piece.

## Purpose
- A carousel builder page: content comes from an array of slides (`type`: cover, point, image, quote, list, cta; title, body, image, accent). The owner edits text in a side panel and sees every slide rendered at true size, scaled down to fit.
- Each slide is exactly 1080 x 1350 px (4:5 portrait). Optionally offer 1080 x 1080 square as a second format.
- Export: a "Download all" button that renders every slide node to PNG with `html-to-image` (`toPng(node, { pixelRatio: 1, width: 1080, height: 1350 })`) and downloads them as numbered files (01-cover.png, 02-...) or a zip with `jszip`. Also a per-slide download button. Wait for fonts (`document.fonts.ready`) and images before exporting.

## Layout
- Preview: slides in a horizontal scroll strip (`flex gap-6 overflow-x-auto snap-x`) with each wrapper using `transform: scale()` so the inner node keeps real pixel size for export.
- Slide anatomy: generous safe margins (80-96 px), brand mark top left, slide counter top right ("2 / 7"), the main message large in the centre (72-110 px display), supporting text 32-40 px, small swipe hint arrow on all but the last slide.
- Cover slide: a hook headline that promises value ("5 dishes you only find here"), strong image or colour field.
- Middle slides: one idea per slide; numbered points, a photo with a short caption, or a big statistic.
- Last slide: call to action (book, visit, save this post), handle or website, and a loop arrow back to the start.
- Headlines can continue across slides (a sentence split across 3 slides) for a playful series.

## Palette and type
- One palette for the whole carousel; vary background between 2-3 related tones from slide to slide so the sequence feels progressive.
- Read brand colours and fonts from the app's theme. Display face bold and characterful, body clean sans. Text must be readable on a phone: nothing under 28 px at 1080 width.
- Elements that cross the edge of one slide into the next (a line, a shape) make swiping feel continuous: render the shape in a wide canvas and slice per slide.

## Details
- Images use `crossOrigin="anonymous"` and local or app-hosted files so export does not taint the canvas.
- Keep text short: under 25 words per slide. Show a character counter in the editor.
- Templates: offer 3 presets (photo-led, type-only, list) that share the same slide data.

## Avoid
- Tiny text, walls of copy, a different style on every slide, important content near edges where app interface overlaps, low-resolution exports, platform logos used as decoration, and hard-coded prices (read offers from data).
