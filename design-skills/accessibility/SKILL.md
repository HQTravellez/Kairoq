---
name: Accessibility
default: on
description: Makes every app usable with a keyboard, a screen reader, zoom and reduced motion, with readable contrast. Targets WCAG 2.2 AA. On by default for every project.
---
# Accessibility (WCAG 2.2 AA)

Accessible apps are better apps: clearer, faster to use and easier to test. Build these in from the start; do not bolt them on.

## Structure and semantics
- One `<h1>` per page, headings in order (h2, h3) that outline the page. Landmarks: `<header>`, `<nav aria-label>`, `<main>`, `<footer>`. Add a "Skip to content" link that appears on focus.
- Use real elements: `<button>` for actions, `<a href>` / `<Link>` for navigation, `<label htmlFor>` for every input, `<table>` with `<th scope>` for tabular data, lists for lists. Never a clickable `<div>`.
- Set `<html lang>` and a meaningful `document.title` per route.

## Keyboard
- Everything works with Tab, Shift+Tab, Enter, Space, Esc and arrow keys where expected (tabs, menus, radio groups, sliders).
- Visible focus on everything: `focus-visible:ring-2` with an offset in a colour that contrasts with the background. Never `outline: none` without a replacement.
- Dialogs and drawers (use Radix primitives): focus moves into them, is trapped while open, Esc closes, and focus returns to the trigger.
- Logical tab order that follows the visual order; no positive tabIndex.

## Screen readers
- Icon-only buttons have `aria-label` ("Remove item", not "X"). Decorative icons and images are `aria-hidden` / `alt=""`; meaningful images have alt text that says what matters.
- Announce dynamic changes: toasts and form results in an `aria-live="polite"` region; errors linked to fields with `aria-describedby` and `aria-invalid`.
- Toggles use `role="switch"` with `aria-checked`; tabs use `role="tablist"`/`tab`/`tabpanel` with `aria-selected`; expanders use `aria-expanded`.
- Loading areas get `aria-busy="true"`; spinners have a text label.

## Visual
- Contrast: body text at least 4.5:1, large text (24 px+, or 19 px bold) and UI parts (borders of inputs, icons, focus rings) at least 3:1. Check muted grey text and text on the brand colour especially.
- Never rely on colour alone: pair it with an icon or text ("Out of policy" not just red).
- Text resizes to 200% without breaking; use rem units, no fixed heights on text containers. Layout reflows at 320 px wide with no horizontal scroll.
- Touch targets at least 44×44 px on phones (24×24 minimum anywhere), with space between them.
- Line length 60-80 characters for reading text; line height 1.5 for body.

## Forms
- Visible labels (placeholders are not labels), required fields marked in text, correct `type` and `autoComplete` (email, tel, name, street-address, one-time-code).
- Errors appear next to the field, say how to fix it ("Enter an email like ana@example.com"), and the first invalid field gets focus on submit.
- Do not clear what the user typed when something fails.

## Motion and media
- Respect `prefers-reduced-motion`: disable parallax, auto-playing animation, smooth scrolling and large transitions (framer-motion `useReducedMotion`, or a CSS media query).
- Nothing flashes more than 3 times a second. Auto-playing video is muted, has controls, and can be paused; captions for speech.

## Before you finish
Tab through every page once in your head: can you reach and use everything, and always see where you are?
