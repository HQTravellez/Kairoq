---
name: Event flyer
description: Printable A4 or A5 flyers and posters for events, openings and special offers, with bold hierarchy, QR code space and exact print sizing.
group: Page types
---
# Event flyer

A flyer has two seconds to be noticed on a wall, a counter or a phone screen. It needs one big idea, the essential facts, and a clear way to act. Think wine tasting nights, live music, seasonal menus, studio open days, shop sales and hotel packages.

## Purpose
- Build a `Flyer` component that takes event data: title, tagline, date and time, venue, short highlights, price or offer label (from data, never typed in), booking URL, contact and image. Offer A4 (210 x 297 mm) and A5 (148 x 210 mm) sizes plus a 1080 x 1920 story-size variant for sharing.
- An editor page around it: a form on the left (or a Sheet on phones) and a live preview on the right, with size switcher, colour theme picker and a Print button.

## Layout
- Page frame: `w-[210mm] h-[297mm]` (or A5) with `overflow-hidden relative`, scaled to fit the preview using a CSS transform wrapper so the real dimensions stay intact for printing.
- Top third: a strong visual: a photo with gradient overlay, a large abstract shape, or a big number ("30% off", "Fri 14"). Leave breathing room.
- Middle: the headline as the visual centre (`text-7xl`/`text-8xl font-black leading-[0.9] tracking-tight`, 2-3 lines max), then one line of supporting text.
- Facts block: date, time, place and price in a tight grid with lucide icons (`Calendar`, `Clock`, `MapPin`, `Ticket`). 3-5 highlights as short phrases.
- Bottom strip: call to action ("Book at ..."), a QR code (render with a small QR library such as `qrcode.react` from the booking URL in data), logo, and small print (age limits, terms).

## Palette and type
- Bold and limited: one dominant colour field, one contrasting accent and white or ink text. Good pairs: tomato and cream, deep green and lime, navy and coral, black and acid yellow. Gradients only if they stay clean.
- Display type with character (Anton, Bebas Neue, Archivo Black, Fraunces Black, Space Grotesk Bold); simple sans for facts. Keep at most two families.
- Decorative SVG elements (circles, waves, stars, grain texture) behind content at low contrast.

## Print CSS
- `@page { size: A4; margin: 0; }` (switch size via a class on the root and a matching `@page` rule).
- `@media print { .no-print { display: none } .flyer { transform: none !important; box-shadow: none } * { print-color-adjust: exact; -webkit-print-color-adjust: exact } }`.
- Keep important text at least 8 mm from edges (safe area) and mention bleed if a print shop is used.

## Details
- Text must survive at arm's length: the headline readable from three metres; minimum 10pt for small print.
- Check contrast of text over photos; add a scrim when needed.
- Provide 2-3 layout presets (photo-led, type-led, offer-led) the owner can switch between.
- Export as image for social sharing with `html-to-image` at 2x pixel ratio.

## Avoid
- Long paragraphs, more than three typefaces, low-contrast pastel text on photos, tiny QR codes (keep at least 25 mm), hard-coded prices, cluttered clip art, and layouts that only work on screen.
