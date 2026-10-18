---
name: Weekly update
description: Weekly update pages or slides for owners and teams covering wins, work in progress, blockers, key numbers, asks and thanks.
group: Page types
---
# Weekly update

A weekly update keeps a small team aligned without a long meeting: what we did, what is in progress, what is stuck and what we need. Owners use it to brief partners; managers use it for front-of-house, kitchen, studio or agency teams.

## Purpose
- An update built from data: week number and dates, team or location, a one-line theme, shipped or done items (with owner), in-progress items (with percent or stage), blockers (with what is needed), key metrics with week-over-week change, asks, and shout-outs.
- Two presentations of the same data: a scrolling page (default) and a slide mode with 6-8 slides navigated by keyboard. Previous weeks are listed in an archive.
- A simple editor form so the owner can fill in the week in a few minutes; numbers are pulled from the app automatically where possible.

## Layout
- Cover: week label ("Week 42, 14-20 Oct"), team name, theme sentence in large type, author avatar.
- Done: a checklist-style list with green check icons, item title, owner avatar and a small link.
- In progress: rows with a progress bar (`h-2 rounded-full bg-muted` with a brand fill), stage label and expected date.
- Blocked: a red-tinted callout card per blocker with what is blocked, why, and the specific help needed.
- Metrics: KPI cards grid (bookings, revenue, reviews, response time); value, change versus last week with arrow, and a 6-week sparkline.
- Asks: a numbered list of requests with the person asked.
- Thanks: shout-out cards with a short note and an emoji-free icon (lucide `Heart`, `Sparkles`).

## Slide mode
- Each section becomes a full-viewport slide (`h-dvh w-full grid place-items-center`), one visible at a time.
- Keyboard: ArrowRight, ArrowLeft, Space, PageDown, Home, End. Sync the slide index with the URL hash (`#/3`) so links open the right slide. Show a slide counter and a thin progress bar.
- Swipe support on touch devices; fade or slide transitions with framer-motion, disabled for reduced motion.

## Palette and type
- Clean neutral theme; brand colour for progress and highlights; green, amber and red only for status.
- Sans throughout (Inter, Manrope). Big numbers in tabular figures.

## Details
- Keep each item to one line; details expand in a popover or accordion.
- Print or PDF: `@media print` shows the page version with each section avoiding breaks.
- Make the theme sentence and blockers the most visible items; they are what readers need.

## Avoid
- Long paragraphs, vanity metrics without context, colour-coded everything, hiding blockers at the bottom, auto-advancing slides, and hard-coded numbers in the copy.
