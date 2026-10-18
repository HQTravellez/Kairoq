---
name: Brutalist style
description: A raw, confident visual style inspired by industrial print and Swiss grids, with heavy grotesque type, hairline rules and one hazard accent.
group: Page types
---
# Brutalist style

Brutalism is honest and loud: structure shown openly, type as architecture, no soft decoration. It suits creative studios, architecture and design firms, record shops, galleries, streetwear, bold bars and anyone who wants to look unlike their competitors. Done well it reads as authority, not chaos.

## Palette and type
- Newsprint canvas (#f2f0eb or pure #ffffff) with true black ink (#0a0a0a). One hazard accent used sparingly: signal red (#ff2a00), safety orange (#ff6b00) or acid yellow (#e6ff00). Optionally invert whole sections to black with white type.
- Heavy grotesque sans for display (Archivo Black, Inter Tight Black, Space Grotesk Bold, Anton for condensed) at monumental sizes; monospace (JetBrains Mono, IBM Plex Mono, Space Mono) for labels, numbers and metadata.
- Uppercase labels with wide tracking, numerals huge and tabular.
- Radius 0 everywhere (`rounded-none`); set `--radius: 0` in the theme.

## Layout
- A visible grid: hairline borders (`border-black` 1px) between columns and rows like a printed form; sections stacked with `border-t`.
- Hero: a viewport-bleeding headline (`text-[16vw] leading-[0.8] tracking-tighter uppercase`) that may run off the edge, a giant number or date, and a small mono caption block.
- Numbered sections: "01 / Services", "02 / Work" in mono at the top left of each section with a rule across the page.
- Content in strict columns (12-column grid, text aligned to column lines); asymmetry is welcome, but alignment is exact.
- Images full-bleed or in hard-edged frames, often high-contrast or black and white, with captions in mono below.
- Lists as tables: rows with borders, index number, title, meta and an arrow (lucide `ArrowUpRight`).
- Decorative ASCII or box-drawing characters for corners and dividers in mono, plus tickers (marquee bands) for news or opening hours.

## Components
- Buttons: rectangular, black fill with white mono uppercase text, or outline with 2px black border; hover inverts colours instantly or shifts by 4px with a hard offset shadow (`shadow-[4px_4px_0_0_#000]`).
- Inputs: square, thick bottom border or full border, mono placeholder.
- Cards: no shadows, only borders; hover fills the accent colour.
- Navigation: a top bar split into bordered cells (logo, links, time or location, a menu button).

## Details
- Motion is abrupt and mechanical: instant state changes, step easing, marquee loops. No soft fades or bouncing.
- Keep contrast and accessibility strong: black on off-white passes easily; the accent is for blocks and highlights, not body text on white if it fails contrast.
- Make it still usable: clear hierarchy, readable body text (17-18 px), sensible line length.

## Avoid
- Rounded corners, gradients, soft shadows, pastel colours, more than one accent, stock illustrations, random misalignment that looks like a bug, and decorative chaos that hides the content.
