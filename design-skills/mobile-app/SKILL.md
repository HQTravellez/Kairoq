---
name: Mobile app
description: Phone-first apps that feel native: bottom tabs, big touch targets, cards and sheets. For guest apps, trackers, booking apps, social and utility apps.
---
# Mobile app

Design for a phone held in one hand. The app should feel like a native iOS or Android app, not a shrunken website.

## Structure
- Bottom tab bar with 3-5 tabs (icon + short label), fixed at the bottom with pb-[env(safe-area-inset-bottom)], bg-card/90 backdrop-blur and a top border. The active tab uses text-primary and a filled or bolder icon.
- Each screen has a large title at the top (text-3xl font-display font-bold) under the safe area (pt-[max(1rem,env(safe-area-inset-top))]), optionally with a small greeting or date above it.
- Content is a vertical stack of cards with 16 px side padding (px-4), 12-16 px gaps, and enough bottom padding to clear the tab bar (pb-28).
- On wide screens, centre the app in a max-w-md column or switch to a side navigation; never stretch phone cards to 1200 px.

## Touch and interaction
- Minimum touch target 44x44 px. Primary actions are full-width buttons (h-12 rounded-xl) near the bottom of the screen where the thumb is.
- Use bottom sheets (Sheet side="bottom") for adding, filtering and details instead of new pages or centred dialogs.
- Lists use rows with a leading icon or avatar, title, subtitle in muted text and a trailing value or chevron; rows have active:bg-muted feedback.
- Segmented controls (TabsList full width) for switching views. Switches for settings.
- Give instant feedback: optimistic updates, toast confirmations, subtle scale on press (active:scale-[0.98]).

## Visual style
- Friendly and bold: rounded corners (radius 1rem to 1.25rem), soft shadows, vivid primary colour, plenty of white space.
- Hero numbers and progress visuals: rings (SVG circle with stroke-dasharray), progress bars, big tabular numbers (text-5xl font-bold tabular-nums).
- Headings in a rounded or geometric sans (Outfit, Plus Jakarta Sans, Sora, Nunito, DM Sans). Body text at least 15-16 px.
- Colour-code categories consistently (for example meals, workouts, rooms) using tints of the palette (bg-primary/10 text-primary, bg-accent/15).
- Dark backgrounds suit fitness, music and night-time apps; light warm backgrounds suit guest and lifestyle apps.

## Content
- Short labels, verbs on buttons ("Add meal", "Open door code"), helpful empty states ("No meals yet. Tap + to add breakfast.").
- Onboarding: 2-4 short steps with a progress indicator, one question per screen, big selectable cards instead of dropdowns.

## Avoid
- Top navigation bars with many links, hover-only interactions, tiny text, tables, multi-column layouts on phones, modal dialogs for everything, desktop-style footers.
