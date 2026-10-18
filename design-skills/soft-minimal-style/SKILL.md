---
name: Soft minimal style
description: A calm, soft and premium minimal visual style with silver or cream canvases, ambient gradients, nested rounded cards and gentle spring motion.
group: Page types
---
# Soft minimal style

This style feels expensive because it is quiet: soft light, precise spacing, tactile surfaces and motion that feels physical. It suits spas, boutique hotels, wellness studios, design-led shops, clinics and premium service apps.

## Palette and type
- Canvas in silver (#f5f5f7), warm cream (#f7f4ef) or misty white; foreground soft black (#1d1d1f) and muted grey (#6e6e73). For dark mode, graphite (#101012) with surfaces at #1a1a1d.
- One gentle accent: a calm blue, sage, sand or the brand colour at reduced saturation. Use it for primary actions and tiny details only.
- An ambient mesh background: two or three huge blurred colour blobs (`absolute -z-10 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30`) in soft hues, plus an optional fine noise overlay at very low opacity.
- Type: a refined sans with tight tracking for headlines (Inter Display-like, Manrope, SF-like system stack via `font-sans`), large headlines `text-5xl md:text-7xl font-semibold tracking-[-0.03em]`, body 17 px with relaxed leading in muted grey.

## Surfaces
- Large continuous corner radii (rounded-3xl for cards, rounded-[2rem] for hero panels). For a squircle look, use generous radii with consistent ratios between nested elements.
- Double bezel cards: an outer shell (`rounded-[28px] p-1.5 bg-white/60 ring-1 ring-black/5 backdrop-blur`) containing an inner panel (`rounded-[22px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`). The inner radius equals the outer radius minus the padding.
- Shadows soft and layered: `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]`. Hairline borders `border-black/5`.
- Glass panels for navigation: `bg-white/70 backdrop-blur-xl` with a hairline bottom border, floating as a pill on scroll.

## Components
- Button in button: a pill CTA (`rounded-full h-12 pl-6 pr-1.5`) whose label is followed by a small circular inner button with an arrow icon; on hover the inner circle moves slightly right.
- Segmented controls and toggles with sliding pill indicators (framer-motion `layoutId`).
- Inputs: soft filled (`bg-black/[0.03] rounded-2xl h-12`), focus ring in the accent at low opacity.
- Feature sections: bento grids of rounded cards with one image or icon each and short text.

## Motion
- Spring physics (framer-motion `type: "spring", stiffness: 300, damping: 30`), small scale on hover (1.02) and press (0.98), elements that rise 12 px and fade in on scroll.
- Smooth, never bouncy for long; respect reduced motion.

## Layout
- Lots of space (py-24 to py-40), centred hero with a short headline and one product or place image floating on the mesh, then alternating feature sections.
- Imagery: bright, airy photography with soft shadows; product shots on clean backgrounds.

## Avoid
- Harsh black borders, saturated colours, dense layouts, mixed corner radii, heavy drop shadows, many fonts, busy patterns, and motion that feels mechanical or slow.
