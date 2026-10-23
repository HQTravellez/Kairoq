---
name: Presentation slides
description: General browser slide decks with minimal, elegant slides, keyboard and touch navigation, slide counter, overview and PDF printing.
group: Page types
---
# Presentation slides

Good slides support a speaker instead of replacing them: a big title, one image, one number or one quote at a time. Use this for staff trainings, workshop talks, client presentations, menu tastings, wedding venue tours or a team meeting.

## Purpose
- A slide engine in React: slides defined as data or as child components (`<Slide>`), each 16:9 at a fixed design size (1280 x 720), centred and scaled to the viewport while keeping proportions.
- Content types: cover, section divider, title with 1-3 lines, big statement or quote, image full bleed with caption, image and text split, stat cards grid, simple chart, comparison, and closing slide with a call to action or "Thank you".

## Layout and type
- Cover: topic in large type (`text-7xl font-semibold tracking-tight`), subtitle in muted grey (`text-2xl`), speaker name and date.
- Content slides: extreme restraint. Title plus 1-3 short lines, or one visual. Leave at least 40% empty space.
- Section dividers: big number and section name on a brand-coloured background.
- Data slides: up to 4 stat cards in a grid aligned to the same baseline, or a single clean chart with direct labels instead of a legend.
- Quote slides: large serif italic quote, small attribution.
- Backgrounds: white or very soft gradient (for example from neutral-50 to neutral-100) for light decks, near-black with a subtle radial glow for dark decks. Pick one and keep it.
- Fonts: one sans for everything (Inter, Manrope, Geist-like) or a serif for titles with a sans body.

## Navigation
- Keyboard: ArrowRight, Space and PageDown go forward, ArrowLeft and PageUp go back, Home and End jump. Keep the index in the URL hash (`#/3`) so refresh and links work.
- Touch swipe and click on the slide edges. A small counter "3 / 18" in the top right corner and a thin progress bar at the bottom.
- Press O or Escape for an overview grid of thumbnails; press F for fullscreen.
- Each slide fades in (opacity and a small translate) with framer-motion; build steps (revealing bullets one by one) optional with a `step` counter. Respect reduced motion.

## Print
- `@page { size: 1280px 720px; margin: 0 }` and in print mode render every slide in sequence, one per page (`break-after: page`), without transforms, counters or controls.
- Also allow exporting a slide as PNG with `html-to-image` for sharing.

## Details
- Slide content comes from data or MDX so the owner can edit; numbers and prices come from the app's data.
- Consistent title position across slides; align elements on a simple grid.
- Speaker notes per slide in a hidden panel or a separate presenter window using BroadcastChannel to sync slides.

## Avoid
- Bullet walls, clip art, more than two fonts, flashy transitions, centred text everywhere, auto-advance timers, and text below 24 px at 1280 width.
