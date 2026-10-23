---
name: Pricing page
description: Plan and package pricing pages with tier cards, billing toggle, comparison table, FAQ and a final call to action, all driven by data.
group: Page types
---
# Pricing page

Pricing pages convert when visitors can match their need to a plan in seconds. Make the choice obvious, the differences honest and the next step one click away. This works for software plans, studio memberships, service packages, room packages, catering menus or class passes.

## Purpose
- Render plans from a data array (`plans`: id, name, tagline, price per period, currency, features, limits, highlighted flag, CTA label and link). Never type prices into JSX; read them from the app's data or settings so the owner can change them. Format with `Intl.NumberFormat`.
- If a plan is "on request", show "Contact us" instead of a number.

## Layout
- Header: small eyebrow ("Pricing"), a clear headline about value ("Simple plans for every size of team"), one line of subtext, and a billing toggle (Monthly / Yearly) built with a segmented control or a Switch. Show the yearly saving as a small badge computed from the data, not hard-coded.
- Plan cards: three (at most four) cards in `grid gap-6 md:grid-cols-3`, equal height with `flex flex-col` and the CTA pinned to the bottom (`mt-auto`). Each card: plan name, one-line who-it-is-for, the price in large type (`text-4xl font-semibold tabular-nums`) with the period in muted text, a primary or outline button, then 5-8 features with `Check` icons from lucide-react.
- Highlight the recommended plan: `ring-2 ring-[hsl(var(--brand))]`, a "Most popular" badge on the top edge, and a slightly stronger background. Only one plan is highlighted.
- Comparison table below: sticky first column and sticky header with plan names; rows grouped by category (Bookings, Team, Support). Use `Check` and `Minus` icons or short values ("Up to 5"). On phones, switch to a plan selector tab with a single column of features.
- Trust row: short testimonials, logos of customer types (as text, not trademarks), or guarantees ("Cancel anytime", "30-day refund").
- FAQ: an Accordion with 5-8 real questions (billing, cancelling, taxes, upgrades, discounts for non-profits).
- Final CTA band: headline, one sentence, primary button, secondary "Talk to us" link.

## Palette and type
- Follow the app theme. Neutral cards (bg-card border) with one brand colour for the highlighted plan and primary buttons. Avoid three different coloured cards.
- Prices in a bold sans with tabular numbers; plan names semibold; features in regular text-sm.

## Details
- The toggle animates the price change (a short fade or number roll with framer-motion), keeping layout stable.
- Show taxes clearly ("excl. VAT") and the currency code when the audience is international.
- Every CTA has a distinct destination (sign up with plan id in the query, booking form, contact form).
- Accessible: the toggle is a real button group with `aria-pressed`, comparison table uses `<th scope>`.
- For service businesses, add an "What is included" detail under each package and a "Custom quote" card.

## Avoid
- Hard-coded prices, fake strike-through discounts, more than four plans, tiny grey feature text, hiding important limits in footnotes, auto-playing carousels of plans, and three "Most popular" labels.
