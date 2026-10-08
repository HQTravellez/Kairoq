"use strict";

// Kairoq-authored runtime guidance. Inspiration: https://github.com/pbakaus/impeccable
// This is not the Impeccable CLI or its deterministic detector engine.
function guidance(kind = "app", style = "editorial", preserve = false) {
  return `KAIROQ DESIGN QUALITY BRIEF:
Before writing files, choose a coherent visual system for this specific audience and task. The requested direction is ${String(style).slice(0,100)}; surface: ${String(kind).slice(0,50)}.
${preserve ? "Keep the existing visual identity and interaction patterns unless the user explicitly requests a redesign. Repair should preserve working flows." : "Choose a distinctive, appropriate identity rather than repeating the same dashboard or landing-page template."}
Define CSS custom properties for colors, type sizes, spacing, borders, radii and focus states. Use a deliberate system-font stack and strong heading/body hierarchy; do not rely on remote fonts. Normal reading text should be at least 16px, compact labels at least 12px. Maintain WCAG AA contrast, visible keyboard focus, associated labels and understandable validation messages.
For business apps, make the user's next task obvious. Prioritize legible data, useful empty states, clear status and a concise primary action. Empty states should explain the first useful step. Give loading, success, failure and disabled states meaningful feedback. Do not add decorative hero sections to daily operational screens.
For marketing websites, communicate the actual offer and audience immediately, build a deliberate section rhythm, and make calls to action lead somewhere useful. Do not invent customers, testimonials, certifications or performance claims.
Use space and typography to establish hierarchy. Avoid unnecessary nested containers, repetitive cards, gratuitous gradients and decorative effects that reduce readability. Icons need accessible names; status must be understandable without color alone.
At 390px, use a readable single-column flow and reachable controls with approximately 44px touch targets; long data must wrap or use an intentional accessible table scroll region. At 1440px, limit reading width and keep data views efficient. Respect reduced motion.
Before returning code, review the login, empty dashboard, populated dashboard, form errors and mobile navigation. Fix clipped labels, low contrast, overflow, competing primary actions and inconsistent spacing. Preserve every required API and testing selector. This design review is guidance, not a substitute for browser QA.`;
}
module.exports = { guidance };
