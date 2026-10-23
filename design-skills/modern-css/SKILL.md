---
name: Modern CSS craft
description: Modern CSS that makes pages feel hand-built without heavy JavaScript: fluid type, container queries, scroll-driven animations, view transitions, :has(), clip-path and mask shapes, balanced text, layered backgrounds. Use on any site; pairs with Tailwind.
---
# Modern CSS craft

Use these in `src/index.css` (with `@layer components`) or Tailwind arbitrary values.

- **Fluid type.** `font-size: clamp(2.5rem, 1.6rem + 4vw, 5.5rem)` for display headings so they scale smoothly between phone and desktop; `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs (Tailwind: `text-balance`, `text-pretty`).
- **Container queries.** Make cards adapt to their column, not the window: `.card-wrap { container-type: inline-size } @container (min-width: 28rem) { .card { grid-template-columns: 1fr 1fr } }` (Tailwind: `@container` and `@md:` variants need the plugin, so prefer the CSS form).
- **Scroll-driven animation (no JS).** `@supports (animation-timeline: view()) { .reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% cover 30%; } } @keyframes rise { from { opacity: 0; translate: 0 2rem } }`. A reading-progress bar: `animation-timeline: scroll(root)` on `scale` from 0 to 1. Wrap in `@media (prefers-reduced-motion: no-preference)`.
- **View transitions.** For smooth page or state changes: `document.startViewTransition?.(() => navigate(to))`, and name shared elements with `view-transition-name: hero-card` so they morph between pages. Feature-detect and fall back silently.
- **:has() for state.** `form:has(:invalid) .submit { opacity: .6 }`, `.card:has(input:checked) { outline: 2px solid var(--brand) }` instead of extra React state for styling.
- **Shapes.** `clip-path: polygon(...)` or `inset(0 round 24px)` for cut corners and reveals; `mask-image: linear-gradient(to bottom, #000 70%, transparent)` to fade long lists or marquees at the edges.
- **Hierarchy in radius and shadow.** Small controls 8 px, cards 16 px, large media 24-32 px; shadows layered and tinted with the brand hue at low alpha (`0 1px 2px rgb(20 24 31 / .04), 0 12px 32px -12px rgb(20 24 31 / .12)`), not one grey shadow everywhere.
- **Texture with restraint.** A 1 px grid via `background-image: linear-gradient(...)` at very low alpha, or an SVG noise data-URI, only behind one section.
- **Colour.** Define the palette once as CSS variables; derive tints with `color-mix(in oklch, var(--brand) 12%, white)` instead of inventing new hex values.
- **Details.** `accent-color` for native checkboxes and ranges, `scroll-margin-top` for anchored sections under a sticky header, `font-variant-numeric: tabular-nums` for prices and stats, `::selection` in the brand colour.
