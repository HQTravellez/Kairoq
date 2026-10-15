---
name: Brand from a logo
description: Builds a complete visual identity (colour palette, type pairing, radius, imagery and voice) from the user's logo or one brand colour, and applies it consistently across the app. Use when the user uploads a logo or names a brand colour.
---
# Brand from a logo

The logo is the brief. Read it carefully, derive a small system from it, write that system down as tokens, and use only the tokens.

## Read the logo
- **Colours:** list the logo's colours as hex. The most saturated one is usually the brand colour; a dark one is the ink. If the logo is one colour on white, that colour is the brand colour and you choose the neutrals.
- **Shape language:** geometric and round (friendly, modern), sharp and angular (technical, bold), high-contrast serif (heritage, luxury), hand-drawn (personal, crafted). This decides type and radius.
- **Weight:** a heavy logo wants confident heavy headings; a thin one wants light, airy type.

## Build the palette (write these as CSS variables and Tailwind colours)
- `brand`: the logo colour, unchanged. Check white text on it reaches 4.5:1 for buttons; if not, use dark text on it or create `brand-strong` (darker by ~10-15% lightness) for buttons and links.
- `brand-50 … brand-900`: a tint and shade scale built in OKLCH by keeping hue and chroma similar and stepping lightness (97, 93, 86, 76, 64, base, 45, 37, 29, 22). Use 50/100 for soft backgrounds and badges, 600-700 for text on light backgrounds.
- Neutrals: greys slightly tinted toward the brand hue (warm brand → warm greys, cool brand → cool greys). Background, surface, border, muted text, ink.
- Semantic: success (green), warning (amber), danger (red), each with a 50 tint. If the brand colour is red or green, shift the danger or success hue so they are never confused with the brand.
- A second accent only if the logo has one. Otherwise the restraint is the identity.

## Type
- Display face that echoes the logo's shape: geometric logo → a geometric sans (Plus Jakarta Sans, Outfit, Sora); grotesk logo → Inter Tight, Manrope, Archivo; serif or crest → Fraunces, Playfair Display, Cormorant; rounded or playful → Nunito, Quicksand, Baloo 2. Body face: a readable sans unless the brand is editorial.
- Load from Google Fonts with `display=swap`; at most 2 families and 4 weights.
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64. Tight tracking on large headings.

## Shape, imagery and voice
- Radius from the logo: round logo → 12-16 px cards and pill buttons; angular → 4-6 px; luxury serif → 0-2 px with thin borders.
- Icons: lucide-react at one stroke width (1.75) that matches the logo's line weight.
- Photography graded toward the palette (warm or cool), or flat illustrations using only palette colours.
- Voice: write a two-line tone guide (e.g. "Warm, direct, a little playful. Short sentences.") and follow it in every heading and button.

## Apply it
- Put the logo in the header at a size where it reads (28-36 px tall), with clear space around it equal to its own height's quarter; a white or single-colour version on dark backgrounds.
- Make the favicon from the logo mark.
- Brand colour for primary actions, links, focus rings and one highlight per screen. Never paint large areas with it unless the logo itself does.
- Record the palette, fonts and radius in the project tokens so later edits keep them.
