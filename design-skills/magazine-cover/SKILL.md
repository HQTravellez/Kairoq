---
name: Magazine cover
description: Bold magazine-cover style posters and hero sections with oversized serif headlines, cover lines, issue details and newsprint texture.
group: Page types
---
# Magazine cover

Borrow the confidence of a printed magazine: a huge masthead, one striking image, a headline you cannot ignore and a few teasing cover lines. Use it for a hero section, a seasonal campaign poster, a menu launch, an annual report cover, or a long "manifesto" page that reads like a newspaper spread.

## Purpose
- A `MagazineCover` component that takes title, issue label, date, main image, headline, kicker, cover lines (3-6 short items with page or section numbers) and a call to action. Content comes from props or the app's content data so the owner can publish a new "issue" each season.
- Works as a screen hero (`min-h-[90vh]`) and as a printable portrait page (A4 or 3:4 ratio).

## Layout
- Dateline bar at the very top: publication name, issue number, date, price label or "Free" from data, set in small mono or small caps with thin rules above and below.
- Masthead: the business name or series title across the full width in a heavy display serif (`text-[14vw] lg:text-[11rem] leading-none tracking-tight`). The image may overlap the masthead slightly using `relative z-10` on the subject for a classic cover effect (use a cut-out PNG if available, otherwise keep the image behind).
- Main headline lower left or centre: 2-4 lines, mixing roman and italic, one word struck through or underlined in the accent colour for wit ("Not ~~fast~~ slow food").
- Cover lines in a column along one side: number or eyebrow in accent colour, short bold line, one-line teaser.
- Corner elements: a circular badge ("New season", "Issue 04"), a barcode-like decorative strip, page edge rules.
- For the long editorial variant: a two-column body (`md:columns-2 gap-10`), numbered sections (01-06) with small headlines, pull quotes in large italic, and a signature with a small ornament at the end.

## Palette and type
- Paper: warm cream (#f4efe6) or newsprint grey (#ecebe6) with near-black ink (#141414) and one loud accent (red #d4261c, cobalt #1f3fd1, or hot orange #ff5a1f). Alternatively a full-bleed photo with white type.
- Display serif (Playfair Display, DM Serif Display, Fraunces, Abril Fatface) for masthead and headlines; a text serif (IBM Plex Serif, Source Serif) for body; mono (JetBrains Mono, IBM Plex Mono) for datelines and numbers.
- Subtle texture: a dot pattern via `bg-[radial-gradient(#0001_1px,transparent_1px)] [background-size:6px_6px]` or a light grain SVG overlay.

## Details
- Very large type needs tight leading (0.85-0.95) and negative tracking; check it does not overflow on phones by using clamp or vw units.
- Image focal point set with `object-position` so faces are not cropped.
- Animate gently on load: masthead slides up, cover lines fade in one by one (framer-motion stagger), respecting reduced motion.
- Print: `@page { size: A4; margin: 0 }`, hide navigation, keep colours exact.

## Avoid
- Generic centred hero with a gradient, small timid headlines, more than one accent colour, too many cover lines, stock photos with no focal point, fake publication brands, and body text set in the display face.
