# Emil Kowalski skills for Kairoq

Upstream: https://github.com/emilkowalski/skills (MIT). Developer install: `npx skills@latest add emilkowalski/skills`.

Select approved, pinned skills from upstream: `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `animation-performance`, `mobile-native`, `break-ui`, `pick-ui-library`, `prototype`.

Route UI and motion tasks through Kairoq's existing engineering-skill-router; use Taste Skill for broader visual direction and Emil's rules for interaction polish and motion quality. Do not animate every component by default. Honor prefers-reduced-motion, accessibility, touch targets, keyboard navigation and performance budgets.

Test layouts with long names, empty states, high counts, tiny screens, reduced-motion settings and animation performance. Record actual screenshot evidence. Avoid claiming passes without browser execution.

Current integration is routing metadata only; upstream skills have not been installed into Kairoq's agent runtime and the router is not yet wired to prompt assembly. Keep production release blocked until these are implemented and verified.
