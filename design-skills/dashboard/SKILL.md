---
name: Dashboard and admin
description: Dashboards, CRMs, admin panels and internal tools. Clear, dense but calm data UI with strong information hierarchy.
---
# Dashboard and admin

People use these screens every day for work. Prioritise clarity, scanning speed and calm. The best dashboards look quiet and precise.

## Palette and type
- Neutral base: light (background #f8fafc or #fafafa with white cards) or dark (background #0b0d12 with #11141b cards). One primary colour for actions and selection, plus status colours used sparingly (green success, amber warning, red danger) as soft tints (bg-emerald-500/10 text-emerald-600 style badges are acceptable for status only).
- Inter, IBM Plex Sans, Manrope or Geist-like sans for everything; JetBrains Mono for IDs and code. font-medium for labels, font-semibold for numbers.
- Radius 0.5rem; thin borders (border-border) do more than shadows.

## Layout
- App shell: a left sidebar (w-64, collapsible to icons; a Sheet on phones) with the product name, grouped navigation with icons and an account menu at the bottom; a top bar with page title, search (⌘K hint) and primary action.
- Page header: title, short description, actions on the right; then filters (date range, segment selects) in one row.
- KPI cards in a 4-column grid: label in muted text, big number (text-3xl font-semibold tabular-nums), change vs previous period as a small coloured badge with an arrow, and an optional sparkline.
- Charts in cards with a title, the main number and a time-range toggle. recharts: no 3D, no pie charts with many slices; use area/line for trends and bars for comparisons; light grid lines (strokeDasharray "3 3", stroke var(--border)), muted axis labels, colours from the tokens (hsl(var(--primary))), tooltips styled like cards, isAnimationActive false for instant rendering.
- Tables: sticky header, comfortable rows (h-12), zebra-free with row hover, right-aligned numbers, status badges, row actions in a dropdown menu, pagination or "Load more", and a toolbar with search and filters. On phones, turn rows into stacked cards.
- Kanban boards: columns with count badges, cards with title, key fields and avatars; drag or move buttons.

## Interaction
- Every list has search, sort and an empty state. Destructive actions confirm in a dialog. Saving shows a toast.
- Loading uses Skeleton rows shaped like the content. Keep layout stable while loading.
- Keyboard friendly: visible focus, Enter submits, Escape closes.

## Avoid
- Rainbow charts, gradients on data, giant hero headers, decorative illustrations, more than two accent colours, centred layouts, tiny 12 px table text.
