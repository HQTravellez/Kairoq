---
name: Waitlist page
description: Minimal pre-launch and coming-soon pages that capture email sign-ups for a new venue, product, course or service, with a delightful success state.
group: Page types
---
# Waitlist page

A waitlist page does one job: make someone curious enough to leave their email. It suits a restaurant opening, a new hotel wing, a course, a product drop or a members' club. Keep it short, focused and a little magical.

## Purpose
- A single centred page with a form that saves sign-ups to the app's database (name optional, email required, optional interest select), with validation, duplicate handling and a thank-you state.
- Optional admin view listing sign-ups with export to CSV and a count.
- Optional referral: after joining, show a personal share link and the person's position in the queue, read from the backend.

## Layout
- Full-height section (`min-h-dvh grid place-items-center px-4`). Content width `max-w-xl text-center`.
- Brand mark or logo at the top, then a small eyebrow pill ("Opening spring", "Coming soon") with a soft pulsing dot.
- Hero headline that says exactly what is coming (`text-4xl sm:text-6xl font-semibold tracking-tight`), one line of subtext about the benefit for early sign-ups (first tables, founding member rate, early access).
- Email capture as one pill: input and button joined (`flex rounded-full border bg-background p-1 shadow-sm` with the button `rounded-full`). On narrow phones, stack them.
- Below: three small benefit items with lucide icons in a row (`grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground`).
- Social proof: avatars stack and "Join 1,240 others" using the real count from the database (hide if small).
- Footer: a short founder's note with a signature or portrait, and social or contact links.
- Optional countdown to launch date from data.

## Palette and type
- A quiet base (off-white or deep night blue) with an ambient decorative layer: a blurred gradient mesh (two or three large `blur-3xl` circles in brand tones at low opacity), a fine noise overlay, or a slow orbiting star path in SVG.
- Modern sans (Inter, Geist-like, Manrope) or an elegant serif headline for hospitality. Brand colour on the button and the dot.

## Interaction
- Submit button shows a spinner, then the form morphs into a success message: a check icon that scales in with a spring (framer-motion), copy changes to "You are on the list" with the next step.
- Errors shown inline under the input in calm red text, with `aria-live="polite"`.
- Respect reduced motion; decoration stays static.
- Add consent text with a link to the privacy policy and a clear opt-in checkbox where required.

## Avoid
- Long pages with many sections, navigation menus that lead away, fake counters, asking for more than two fields, stock illustrations, a different button style for the success state, and launch prices hard-coded in the copy.
