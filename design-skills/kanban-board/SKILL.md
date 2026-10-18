---
name: Kanban board
description: Internal task boards with columns, cards, labels, due dates, assignees, filters and drag-and-drop for small teams.
group: Page types
---
# Kanban board

A board shows the state of work at a glance: what is waiting, what is happening, what is done. Small teams use it for housekeeping tasks, event preparation, content calendars, maintenance requests, client projects and hiring.

## Purpose
- Columns and cards stored in the app's database (board, columns with order and optional work-in-progress limit, cards with title, description, labels, assignee, due date, checklist, comments count, priority and position).
- Real drag and drop with `@dnd-kit/core` and `@dnd-kit/sortable` (pointer and keyboard sensors), saving the new column and position optimistically, with a rollback and toast on error. Also provide a "Move to" menu for accessibility and phones.

## Layout
- Page header: board name, member avatars, view switcher (Board, List, Calendar), and a primary "New card" button.
- Filter bar: search, assignee multi-select, label filter, due (overdue, this week), and a "Clear filters" link. Show active filters as removable chips.
- Columns: default To do, In progress, In review, Done (editable). Each column `w-72 shrink-0 rounded-xl bg-muted/50 p-2` with a header showing name, card count badge and a menu (rename, set limit, collapse). When over the limit, the count turns amber.
- Board area scrolls horizontally (`flex gap-4 overflow-x-auto pb-4`) with snap on phones; each column scrolls vertically within the viewport.
- Cards: `rounded-lg border bg-card p-3 shadow-sm hover:shadow` with labels as small colour chips at the top, title (font-medium, 2-line clamp), and a footer row with due date (red when overdue, amber when soon), checklist progress (3/5), comment count, attachment icon and assignee avatar.
- Optional swimlanes: group rows by assignee, area (Kitchen, Rooms) or project, with collapsible lane headers.
- Card detail: a Sheet or Dialog with editable title, description (markdown), fields in a side column, checklist, activity and comments.

## Palette and type
- Neutral background, white or dark cards, labels from a fixed set of soft colours (bg-*-500/15 with matching text) chosen by the user.
- Sans UI type (Inter); compact but readable (text-sm cards, never smaller than 13 px).

## Interaction
- While dragging, the card lifts (shadow-lg, slight rotate) and a placeholder keeps its space; drop targets highlight.
- Quick add at the bottom of each column: type a title and press Enter.
- Keyboard: arrows to move focus, Space to pick up, Escape to cancel.
- Empty column shows a dashed drop zone with a hint.

## Avoid
- Fake drag that does not save, more than seven columns, cards with every field visible, bright saturated label colours, horizontal scroll without visible scrollbars on desktop, and losing the card position after refresh.
