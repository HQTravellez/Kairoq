---
name: Social share card
description: 1200x630 share images, link preview cards and quote or stat cards generated from app content and exportable as PNG.
group: Page types
---
# Social share card

When a page link is shared in chats or social feeds, a good preview image doubles the clicks. Quote and stat cards also make great posts on their own: a guest review, a chef's line, an opening date, a milestone number.

## Purpose
- A `ShareCard` component rendered at exactly 1200 x 630 px (1.91:1), with variants: `link` (page title, description, site name), `quote` (quote, author, role, avatar), `stat` (big number, label, context) and `announcement` (event or offer).
- Content from props: the page's own title and summary, a review from the reviews table, a metric from the app. No hard-coded prices or numbers.
- A card studio page: choose a variant, edit text, pick theme (light, dark, brand), preview scaled to fit, and export to PNG with `html-to-image`. For automatic link previews, document the generated image path so the app can set `og:image` and related social meta tags in the page head.

## Layout
- Safe area: 64-80 px padding on all sides; key content inside the central 1100 x 530 area.
- Top left: small category tag ("Review", "New", "Insight", "Event") as a pill.
- Centre: the hero line. For quotes, 2-3 lines at 56-68 px semibold with an oversized opening quotation mark in the accent colour. For stats, the number at 160-200 px with tabular numbers and a one-line label below.
- Bottom row: author avatar (circle 56 px), name and role on the left; logo or site name as a small watermark on the right.
- Link variant: left 60% text (site name, title at 56 px, short description), right 40% image cropped with `object-cover` and rounded corners, or a full-bleed photo with a dark gradient for the text.

## Palette and type
- Choose dark or light by mood: dark (#0f1115 with soft glow gradient) for bold statements, light paper (#faf8f3) for warm reviews. Brand colour for the tag, quotation mark and small highlights.
- Subtle texture for depth: a faint grid (`bg-[linear-gradient(...)]` with 40 px cells at 5% opacity), dots, or noise. Never at the cost of legibility.
- One display face for the hero line and one sans for metadata; read both from the theme.

## Details
- Auto-fit text: measure length and step the font size down (for example 68, 60, 52, 46) so long quotes still fit in three lines; clamp with `line-clamp-3` as a last resort.
- Wait for `document.fonts.ready` before exporting; use same-origin images.
- Generate a set at once for a list of reviews or posts (batch export) for scheduling.
- Keep accessible text alternatives: the page that uses the card should also have real text, and the image alt should repeat the message.

## Avoid
- Tiny text that disappears in a thumbnail, more than 25 words, busy photo backgrounds behind text, platform logos or names on the card, edge-hugging content that gets cropped, and stats or prices typed in by hand.
