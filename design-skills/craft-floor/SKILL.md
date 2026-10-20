---
name: Craft floor
description: The minimum every page must meet before it ships: readable contrast and line length, real states, honest copy, visible focus, one considered motion moment, and none of the generic "made by AI" template look. On for every project.
default: on
---
# Craft floor

Adapted for Kairoq from three open sources, rewritten for React, Tailwind and Kairoq's design tokens: impeccable by Paul Bakaus (Apache License 2.0; the craft floor and its list of defaults to refuse), open-design by nexu-io (Apache License 2.0; anti-AI-slop, state coverage and form rules) and ui-ux-pro-max-skill by Next Level Builder (MIT; UX guidelines). Kairoq's design reviewers check the same list.

These are mechanics, not a style. The design brief and the owner's wishes choose the direction; this makes sure whatever is chosen is built well.

## Check on the finished page
- **Contrast:** body text and placeholders at least 4.5:1 against their background, large text at least 3:1. Secondary text on a coloured surface is a tint of that colour or the foreground, never a pale grey that fades out.
- **Reading:** body text lines 65 to 75 characters wide (`max-w-prose` or `max-w-[65ch]`); headings balanced (`text-balance`); clear steps between heading sizes and weights; more space above a heading than below it.
- **Spacing:** related things close together, groups clearly separated; the same spacing scale everywhere (Tailwind steps, not random pixel values).
- **Depth:** shadows soft and offset downward, used sparingly; borders do most of the separation.
- **States:** every button and link has hover, keyboard focus (a visible `focus-visible` ring) and disabled styles; every list has an empty state that says what to do; every form shows loading while it sends, a clear success message, and an error that says what went wrong and how to fix it; data screens show a skeleton while loading.
- **Forms:** labels above fields (never placeholder-only), the right input types (`email`, `tel`, `date`), errors next to the field after the visitor leaves it, the submit button says what it does ("Send booking request", not "Submit").
- **Motion:** one considered moment (the hero, or a key reveal), not the same fade-in on every section. Short ease-out transitions on interactions; everything still works and nothing jumps with `prefers-reduced-motion`.
- **Browser details:** a themed text selection (`selection:bg-primary/20`), focus rings in the brand colour, tabular numbers in prices and tables (`tabular-nums`), underline offset on text links.
- **Copy:** the business's own words and facts. Buttons name their action; headings say something specific about this business.
- **Phones:** tap targets at least 44px, nothing wider than the screen, navigation that works with a thumb.

## Refuse (unless the brief truly asks for it)
Page structure:
- Rows of identical cards (icon, title, two lines) as the structure of every section. Vary the layout: a split section, a list, a photo with text, a quote. Cards inside cards are always wrong.
- The "big numbers" hero (10k+ customers, 99% satisfaction) when the business never gave those figures. Never invent metrics, reviews, awards or logos.
- A small all-caps label above every heading. The heading carries itself.
- Section numbers (01 / 02 / 03) unless the order matters to the visitor.
- A pop-up for something that does not need to interrupt.

Surfaces:
- Gradient text, and a two-colour gradient behind the hero. Emphasis comes from size and weight.
- The default indigo or purple accent when nothing about the business suggests it. Pick colours from the business: its photos, its trade, its place.
- Decorative glass blur, glowing blobs and random floating shapes.
- A thick coloured stripe down one side of cards, list items or alerts.
- Hard offset "brutalist" shadows outside a deliberately brutalist design.
- Corner radius above about 16px on cards and buttons by default.
- Emoji or text symbols as icons: use lucide-react icons, one size and stroke throughout.
- Filler copy: "Unlock your potential", "Seamless solutions", "Elevate your experience", "Lorem ipsum".

When every check passes, spend the remaining effort on what makes this business distinct: its photos, its words, one memorable detail.
