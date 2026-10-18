---
name: Digital guide
description: Lead-magnet e-guides, brochures and welcome books laid out as printable book-like pages with a cover, contents, lessons and checklists.
group: Page types
---
# Digital guide

A digital guide is a small, beautiful booklet a business gives away or sends after booking: "The local's guide to our town", "How to prepare for your first class", "Wedding planning checklist", "Guest welcome book". It should feel like a well-made print publication that also reads nicely on screen.

## Purpose
- A `Guide` made of page components (`Cover`, `Contents`, `Chapter`, `Lesson`, `Checklist`, `BackCover`) fed by structured content (chapters, sections, tips, images, checklist items, author). Content lives in the app so the owner can edit it.
- Two views: a screen reader view (spreads side by side like an open book on desktop, single pages on phones) and a print view producing one page per sheet for PDF download via `window.print()`.
- Optionally gate the download behind an email form (lead magnet) that saves the contact before revealing the guide.

## Layout
- Page size A4 or A5 portrait (`w-[148mm] h-[210mm]` for A5), with consistent margins (15-20 mm), page numbers in the footer and a running title in the header.
- Cover: a large display title, subtitle, author or business name, a warm photo or illustration, and a "What is inside" mini list (for example 7 chapters, 25 tips, 1 checklist).
- Contents page: chapter numbers in a large light numeral, titles, short descriptions and page numbers aligned right with dotted leaders.
- Chapter opener: big number, title, intro paragraph, full-bleed image.
- Lesson pages: readable body text, a pull quote, numbered steps, tip boxes ("Local tip", "Good to know") and small icons.
- Checklist page: checkboxes that work on screen (state saved locally) and print as empty boxes.
- Back cover: call to action (book now, use code, visit), contact details and QR code to the booking page.
- Screen spread: `grid lg:grid-cols-2 gap-0 shadow-xl` with a subtle centre gutter shadow to suggest a book fold.

## Palette and type
- Soft lifestyle tones: cream (#f6f0e6), sand, sage, clay or blush, with dark ink text and one accent. Calm, not loud.
- An elegant serif for titles (Fraunces, Cormorant, Playfair Display) and a warm sans for text (DM Sans, Nunito Sans). Body 10-11 pt in print.

## Print CSS
- `@page { size: A5; margin: 0 }` (or A4), each page `break-after: page`, `print-color-adjust: exact`, hide toolbars and the spread shadow, and remove scaling transforms.
- Images at least 200 dpi for the printed size; captions under images.

## Details
- Generous whitespace, consistent grid, and a rhythm of text page, image page, tip page.
- Links in the PDF are real anchors with visible URLs or QR codes for print.
- Avoid putting any price in the guide copy unless it is read from current data, because guides live a long time.

## Avoid
- Slide-like pages with little text, dense walls of copy, too many fonts, dark full-page backgrounds that waste ink, low resolution images, and checklists that cannot be used on screen.
