---
name: Illustrations and icons
description: A consistent icon and illustration system: one icon set, one stroke and size scale, and simple on-brand SVG illustrations for empty states, onboarding and heroes. Use for any app that needs icons or spot illustrations.
---
# Illustrations and icons

Consistency is what makes icons and illustrations look designed. Pick one style, define it in a few numbers, and never mix.

## Icons
- Use lucide-react only (ISC license). Never mix icon sets, emoji and custom glyphs in the same UI.
- Sizes: 16 px inline with small text, 18-20 px in buttons and navigation, 24 px for feature or empty-state icons. Stroke width 1.75 everywhere (2 for very small sizes). Pass `aria-hidden="true"` when the icon sits next to a text label; give icon-only buttons an `aria-label`.
- Colour: icons take the text colour (`currentColor`); the brand colour only for the active nav item or a status. No rainbow icons.
- Icon containers: if you put icons in a shape, use one shape (circle or rounded square) at one size with a 50-tint background, and only where it helps scanning (settings lists, feature rows). Do not put every icon in a box.
- Pick meaning, not decoration: an icon earns its place when it helps recognition (nav, actions, file types, status). Remove icons from headings and paragraphs that read fine without them.
- Align optically: icons centred with the cap height of the text, gap of 6-8 px.

## Spot illustrations (inline SVG)
Draw simple illustrations as inline React SVG components when the app needs them (empty states, onboarding steps, 404, success screens). Style rules:
- Flat shapes, 2-3 palette colours plus the ink, one stroke width (2 px, round caps and joins) if outlines are used. No gradients unless the whole brand uses them.
- Compose from simple geometry: a document, a calendar, a suitcase, a map pin, a chart, a plant, a person as a circle head and rounded body. Keep it under ~25 shapes.
- Same viewBox (e.g. 0 0 240 160), same perspective (flat front view) and same scale of objects across the app.
- One small accent per illustration in the brand colour (a check mark, a pin, a highlight).
- Empty states: illustration (max 160 px tall), a heading that says what is missing ("No trips yet"), one line on why it matters, and the primary action.
- Mark decorative SVGs `aria-hidden="true"`; give meaningful ones a `<title>`.

## Larger illustrations and images
- For heroes, prefer a real product screenshot or photography. Use an illustration only when the brand is illustrative.
- If images are generated, ask for one consistent style in every prompt (e.g. "flat vector illustration, limited palette of #1d4ed8, #f59e0b and #0f172a, white background, no text") so the set matches.
- Openly licensed illustration sets are fine (credit them where the license asks).

## Avoid
- 3D clay blobs, floating abstract shapes and isometric stock scenes that say nothing about the product.
- Emoji as icons in product UI.
- Different stroke widths, corner styles or perspectives side by side.
