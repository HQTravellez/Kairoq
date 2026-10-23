---
name: Chakra UI design direction
default: on
group: visual
description: Premium React UI guidance using Chakra UI v3 composition patterns and accessible component structure. Use Chakra components only when the runtime dependency is installed and explicitly supported; otherwise implement the same quality using Kairoq's existing Tailwind and Radix kit.
---
# Premium UI with Chakra design principles

Create production-quality screens, not generic wireframes. This skill improves the **design outcome** and does not authorize importing unavailable packages.

## Design direction
- Start with a clear visual system: surface/background, foreground, muted text, primary action, subtle borders, radius, shadow, spacing and typography tokens. Apply it consistently to every page.
- Prefer a refined, calm SaaS aesthetic: generous whitespace, strong alignment, clear navigation, meaningful typography and restrained use of color.
- Build reusable primitives for Button, Input, Field, Card, Dialog, Tabs, Menu, Table, Badge, Alert and Skeleton. Reuse Kairoq's existing src/components/ui kit by default.
- On dense dashboards use compact, scannable cards, well-spaced tables, accessible filters, responsive sidebar navigation, helpful empty states, and contextual actions.
- On landing pages show a clear product promise, a realistic product preview, genuine proof only, strong calls to action and restrained motion.
- Use a coherent spacing scale, responsive grids and readable typography. Avoid arbitrary one-off margins and mismatched radii.
- Make interactions functional: forms validate, buttons respond, loading states are visible, errors are actionable and success states are announced.
- Ensure keyboard focus, contrast, semantic labels, reduced motion and touch targets. Verify at phone and desktop widths.

## Chakra UI v3 reference
Source: https://github.com/chakra-ui/chakra-ui
Docs: https://chakra-ui.com/docs/get-started/installation
- Chakra UI v3 uses compositional components (for example, Dialog.Root, Dialog.Trigger and Dialog.Content), and a provider using a Chakra system. Do not assume Chakra v2 APIs such as useToast or the old standalone modal patterns.
- When and only when @chakra-ui/react is installed and the builder allowlists it, use its actual supported v3 exports and wrap the app with ChakraProvider configured with a valid system.
- Do not import @chakra-ui/react, @emotion/react or other packages into generated apps until their dependency and bundling checks pass. Never silently replace Kairoq's existing component kit.
- If Chakra UI isn't enabled, reproduce the design quality using Tailwind and the installed Radix-based kit instead.

## Visual acceptance criteria
- Desktop and mobile screenshot review; no clipped content or sideways scrolling.
- Consistent component sizing, color tokens, focus rings, error states and typography.
- Functional keyboard navigation and real data workflows.
- Repair visual failures before declaring a build finished.
