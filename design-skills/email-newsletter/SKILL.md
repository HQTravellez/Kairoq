---
name: Email newsletter
description: Email-safe newsletters and promotional emails at 600px with table layout, inline-friendly styles and bulletproof buttons, plus a page preview.
group: Page types
---
# Email newsletter

Email clients are far stricter than browsers: many ignore flexbox, grid, external CSS, web fonts and custom properties. Build emails that survive old desktop clients, webmail and phones, while keeping them warm and on-brand. The app may also show the same email as a live preview page.

## Purpose
- Create an `EmailTemplate` component (or a function that returns an HTML string) that takes content from the app: subject, preheader, hero image, headline, body blocks, offers, events, CTA URL, footer details and unsubscribe link. No hard-coded prices or dates; read them from data.
- Provide a preview route that renders the email inside a centred 600px frame on a grey canvas, with a desktop/phone width toggle and a "Copy HTML" button that copies the rendered markup (`renderToStaticMarkup`).

## Layout
- Outer wrapper table at 100% width with a background colour; inner content table `width="600"` centred, `role="presentation"`, `cellPadding=0`, `cellSpacing=0`, `border=0`.
- Hidden preheader text right after the body opens (display none, small font, zero opacity) so inbox previews show a useful line.
- Header: logo image (width and height attributes set, alt text) centred or left, optional date or issue number.
- Hero: full-width image (600px wide, `display:block`, max-width 100%), then a headline (24-30px) and 2-3 short paragraphs.
- Content blocks as single-column rows: an offer card, an event list, a two-column product or room pair (stack on phones via a media query, with sensible single-column fallback), a quote from a guest.
- Bulletproof button: a table cell with background colour, padding and border radius, containing a link with the same colour, bold text and generous padding. The button must still be readable if images are off.
- Footer: business address, reason for receiving, unsubscribe and preferences links, social links as text or small images.

## Styles
- Put styles inline on elements (`style={{ ... }}` in React) for colours, font, padding and alignment. Keep a small `<style>` block only for the mobile media query and link resets.
- Font stacks: Arial, Helvetica, sans-serif or Georgia, serif. Web fonts are optional progressive enhancement only.
- Use hex colours, not CSS variables. Read the brand colour from settings and inject the hex value.
- Body text 16px with 1.5 line height; headings 22-30px. Minimum 14px anywhere.
- Width attributes on images and tables, `alt` on every image, `border:0` on linked images.

## Details
- Keep total HTML under about 100 KB so it is not clipped.
- Dark mode: avoid pure black text on transparent PNGs; give logos a padded background.
- Links have full absolute URLs from config; track parameters are added from data, not typed.
- Write copy for small businesses: one clear message per email (seasonal menu, last rooms for a weekend, new class schedule), short paragraphs, one primary action.

## Avoid
- Flexbox, grid, position, background images for key content, JavaScript, forms, video embeds, CSS variables, external stylesheets, text baked into images, more than one primary button, and missing unsubscribe links.
