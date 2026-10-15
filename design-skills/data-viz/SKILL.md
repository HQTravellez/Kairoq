---
name: Charts and data
description: Clear, honest charts, KPI tiles and dashboards with recharts. Use whenever the app shows numbers over time, comparisons, breakdowns or progress.
---
# Charts and data

A chart answers one question. Decide the question first ("Is spend going up?", "Which team spends most?"), then pick the form and remove everything that does not help answer it.

## Pick the form
- Change over time: line chart (area only for a single series or a stacked total). Bars for counts per period when there are fewer than ~20 periods.
- Compare categories: horizontal bar chart, sorted by value, labels on the left. Never a pie chart for more than 3 parts; a donut only for one part of a whole with the number in the middle.
- Part of a whole over time: stacked bars, max 4-5 segments, largest at the bottom.
- Distribution: histogram. Relationship: scatter.
- One number that matters: a KPI tile instead of a chart.

## KPI tiles
- Label ("Revenue this month"), the value large with tabular figures, the change with direction and period ("+12% vs last month"), and colour the change by meaning (green good, red bad; for costs, up is bad). Optional sparkline. Four tiles per row at most.

## Recharts defaults
- Wrap charts in `<ResponsiveContainer width="100%" height={280}>`.
- Light horizontal grid lines only (`<CartesianGrid vertical={false} stroke="#e5e7eb" />`), no chart border, no 3D, no shadows.
- Axes: no axis line, small muted ticks, formatted values (`tickFormatter` with Intl: "$12k", "Mar 4"), at most 5-6 ticks. Start bar charts at zero.
- Tooltip: a small card with the date and every series value formatted; `cursor` as a light band.
- Lines: 2 px, no dots except on hover (`activeDot`), `type="monotone"` only if smoothing does not mislead.
- Legend only with 2+ series; better: label lines directly at their end.
- Animate once on load (recharts default) and not on every update.

## Colour
- One series: the brand colour. Several: the brand colour for the main series and neutral greys for comparison, or a small categorical palette (max 6) that works for colour-blind readers (blue, orange, teal, pink, olive, grey). Same category = same colour on every chart in the app.
- Sequential data (heatmaps): one hue from light to dark. Diverging: two hues around a meaningful midpoint.
- Check it works in dark mode: lighter strokes, darker grids.

## Dashboards
- Top row: the 3-4 KPIs that matter. Then the main trend chart full width. Then breakdowns side by side. Then the detail table.
- A date range control at the top that drives everything ("Last 30 days", "This quarter", custom), and show the range in the subtitle.
- Every chart has a title that states the question or finding, a subtitle with the unit and period, and an empty state ("No trips yet in this period") instead of an empty axis.
- Loading: skeletons the shape of the chart.

## Honesty and access
- Never truncate a bar axis, never use dual axes that imply a false correlation, label estimates and samples as such.
- Provide the numbers too: a table view toggle or `aria-label` summary ("Spend rose from $12k in Jan to $18k in Mar").
