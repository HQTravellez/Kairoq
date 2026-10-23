---
name: Monthly report
description: Printable monthly business reports with headline KPIs, revenue and booking charts, summary tables, highlights and an outlook section.
group: Page types
---
# Monthly report

A monthly report tells an owner, partner or investor how the business is doing in a few minutes: what changed, why, and what happens next. It mixes numbers, charts and short written insight. Think hotel occupancy and revenue, restaurant covers and average spend, shop sales by category, agency billable hours.

## Purpose
- A report page that reads a period (month and year) and pulls figures from the app's data: revenue, bookings or orders, average value, occupancy or utilisation, costs, new versus returning customers, top items. Compute comparisons to the previous month and the same month last year in one place.
- Period picker at the top, with print and share actions. The same layout prints neatly to A4 portrait.

## Layout
- Masthead: business name, "Monthly report", period, prepared date, and a one-sentence headline summary written from the numbers ("A strong month driven by weekend stays").
- Hero KPIs: 4 cards in a grid; label, big number (`text-3xl font-semibold tabular-nums`), change badge with arrow and colour (green up, red down, unless lower is better like costs), and a sparkline of the last 12 months.
- Charts: revenue over time (area or bar by day or week, with last year as a faint line), a breakdown by channel or category (horizontal bars, sorted), and costs or margin trend. Use recharts with brand colours from CSS variables, light grid lines and clear axis labels.
- Summary table: a profit and loss style table or category table with sticky header, right-aligned numbers, subtotal rows in semibold and a total row with a top border.
- Highlights: 3-5 bullets of what went well and what needs attention, each linked to a number.
- Outlook: a short paragraph and the next month's targets.
- Methodology and notes: a collapsible section explaining definitions and data sources (open in print).

## Palette and type
- Calm and professional: white or off-white, ink text, brand colour for the main series, one neutral grey for comparison series, and status colours only for changes.
- Sans with tabular figures (Inter, IBM Plex Sans); optionally a serif for the masthead.

## Print CSS
- `@page { size: A4; margin: 14mm }`. Hide nav and toolbars; charts get fixed heights and `isAnimationActive={false}` so they render before printing.
- `break-inside: avoid` on cards and charts, a `break-before: page` before the detailed table if needed, repeated table headers.

## Details
- Every number shows its unit and currency, formatted with `Intl.NumberFormat`; never type numbers into the layout.
- Handle missing data gracefully ("No data for this period") instead of zeros that look like real results.
- Footnotes for unusual effects (closed for renovation, holiday weekend).

## Avoid
- Pie charts with many slices, 3D charts, rainbow palettes, decorative illustrations, unexplained percentages, changes without a baseline, and charts that animate in print.
