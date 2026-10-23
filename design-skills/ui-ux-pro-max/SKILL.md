---
name: UI UX Pro Max — Kairoq
description: Product-specific visual intelligence inspired by nextlevelbuilder/ui-ux-pro-max-skill. Choose industry-appropriate design direction, accessible components, typography, layout, motion, and chart treatments; validate across desktop and mobile.
default: on
group: visual
---

# UI UX Pro Max — Kairoq design guidance

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
License: MIT (upstream). This file is a Kairoq-native adaptation, not a copy of the upstream search engine or its data catalogs.

## Product-first design workflow
1. Identify product type, audience, key task, information density, platform, and installed frontend stack.
2. Pick a design direction matched to the product, not a generic blue/purple dashboard. For travel and corporate software favor clear hierarchy, trustworthy booking states, concise tables, and calm visual systems; for kids' learning favor larger targets, expressive visuals, and limited text.
3. Define one design system before coding: background, surface, foreground, muted, primary, accent, danger, borders, focus, font pairing, spacing scale, corner radii, shadows, and responsive breakpoints.
4. Choose the page composition and UX flow: navigation, key task above the fold, supporting content, helpful empty/loading/error/success states, and honest sample-data labels.
5. Use the existing Kairoq React/Tailwind/Radix kit by default. Apply the Chakra UI design skill as complementary component guidance; never import uninstalled packages or silently change the app's frontend stack.
6. Build functional components and use real application state. Do not present static mockups as functioning booking or payment flows.
7. Perform browser visual QA and targeted repair, checking 375/390px mobile, 768px tablet, 1024px laptop and 1440px desktop where practical.

## Accessibility and interaction gates
- WCAG-aware contrast: body text at least 4.5:1; do not convey state by color alone.
- Visible keyboard focus, semantic landmarks, accessible names for icon-only controls, labels and contextual validation for inputs.
- Touch targets should be approximately 44x44 CSS pixels where practical, with comfortable separation.
- Text must wrap or disclose its full meaning; never clip critical labels, IDs, badge counts, or form errors.
- Avoid horizontal overflow and hidden actions on mobile. Use responsive tables with clear affordances.
- Reserve image dimensions, use appropriately sized media, and prevent layout shift.
- Respect reduced-motion preferences; avoid distracting animations and effects that obscure primary tasks.
- Prefer Lucide/SVG icons over emojis for navigation and status. Use semantic tokens rather than one-off color literals.
- Charts must use legible scales, labels, and legends and not rely on color alone.

## Industry-specific decision examples
- Corporate travel: booking-first information architecture, itinerary clarity, policy and approval states, budgets and spend reporting, accessible search forms.
- Corporate housing: availability, property imagery, monthly pricing, inquiry status, cleaning/services, long-stay comparison.
- Fintech and insurance: high trust, restrained color, transparent numbers, legible coverage, explicit consent and error states.
- Education for children: age-appropriate readability, large touch targets, clear progress, reduced cognitive load.
- AI app builders: inspectable build progress, test evidence, preview, revision history, and understandable errors.

## Kairoq acceptance criteria
- Generate a coherent and product-appropriate design system before first page implementation.
- Verify mobile and desktop screenshots, no clipped text or sideways scroll, functional navigation, working filters/forms, and clear loading/error states.
- Preserve user data and business logic during redesign; avoid unverified product claims and fabricated social proof.
- On failure, identify the exact component and repair, then retest before marking the design complete.
- The upstream repository also includes a Python search engine and CSV catalogs. Those are **not bundled in this adaptation**; do not claim that its 192-product catalog or BM25 retrieval is executing until separately integrated and tested.
