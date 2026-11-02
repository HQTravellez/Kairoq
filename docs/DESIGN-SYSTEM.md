# Kairoq design system (the builder, /create)

The bar: Lovable and Emergent. Calm, light, roomy, one accent, nothing that looks like an
admin tool. Every screen, dialog, card and menu follows these rules. Owners and clients see the
same polish; owner-only internals (env var names, repo names, Railway notes) never show to clients.

## Tokens (already on `body.app` in public/calm.css; use them, do not invent new colours)
- Page `--c-bg #FAFBFC` · Panel `--c-panel #FFF` · Raised/hover fill `--c-raise #F4F6F8`
- Ink `--c-ink #2A2D32` (headings `#1B1D22`) · Secondary `--c-ink-2 #5C6168` · Muted `--c-ink-3 #737980`
- Lines `--c-line #EDEFF2` (dividers, card borders) · `--c-line-2 #D8DBE0` (inputs)
- Accent `--c-accent #0A2A52` (primary buttons, focus, selected) · Success `#1F8A5B` · Danger `#C2412D` · Warning `#B7791F`
- Font: Geist (system sans fallback). Mono: Geist Mono.

## Type scale
- Dialog / page title 20px/600, -0.01em · Section title 15px/600 · Body 14.5px/1.6 · Small 13px · Caption 12px muted
- Sentence case everywhere. No ALL CAPS labels. No tracked-out eyebrows.

## Spacing and shape
- 4px grid. Dialog padding 24px. Gap between sections 20–24px, between fields 14px.
- Radius: dialogs 16px · cards and inputs 10–12px · buttons 10px · chips 999px.
- Shadows: cards `0 1px 2px rgba(16,24,40,.05)`; floating (dialogs, menus) `0 24px 48px -16px rgba(16,24,40,.25)`.
- Borders 1px `--c-line`. No double borders, no boxes inside boxes inside boxes.

## Components
- **Primary button**: accent fill, white text, 36px tall, 0 14px, radius 10, weight 500. One per view.
- **Secondary button**: white, 1px `--c-line-2`, ink text. **Ghost/link**: no border, ink-2, hover fill `--c-raise`.
- **Danger**: white with danger text; filled danger only in a final confirm.
- **Inputs / selects / textareas**: 38px tall (textarea auto), white, 1px `--c-line-2`, radius 10, 0 12px, focus ring 3px rgba(10,42,82,.12) + accent border. Labels above, 13px/500 ink-2. Help text 12.5px muted below.
- **Dialogs**: 560px default (wide 860px), white, radius 16, padding 24, title + one-line muted subtitle, content sections separated by space (not rules), actions bottom-right (secondary then primary). Close (×) top-right. Backdrop rgba(17,24,39,.35) with 2px blur.
- **Cards / list rows**: white, 1px line, radius 12, padding 14–16; hover fill `--c-raise`. Lists of rows: one bordered container with dividers, not a box per row.
- **Tabs / segmented**: raised track, white selected pill with tiny shadow.
- **Chips / badges**: 24px tall, radius 999, 12px text; status colours as text on a 8% tint.
- **Tables**: header row raised, 13px; cells 10px padding; row dividers only.
- **Empty states**: one short sentence + one action. Never a wall of text.
- **Menus**: one line per item (details in tooltip), group labels 11.5px muted.
- **Icons**: 16px stroke 1.7, currentColor.

## Words
Plain, short, user-facing. Name things by what users get, not how it is built. Owner-only
setup details ("Set KAIROQ_X", repo names) appear only to the owner, inside Admin.
