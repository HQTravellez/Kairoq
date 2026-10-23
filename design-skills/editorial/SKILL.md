---
name: Editorial and content
description: Blogs, magazines, portfolios, newsletters and documentation. Typography-led design with great reading comfort and strong imagery.
---
# Editorial and content

Typography is the design. Readers should enjoy long text, and every page should feel curated like a good magazine.

## Palette and type
- Paper-like backgrounds (#fbfaf7, #f7f4ee) or a deep ink dark mode (#111111); foreground near-black (#161616). One accent colour used for links, tags and small highlights (vermilion #d6452f, forest #2f5d50, cobalt #2747d1).
- Headlines in an expressive serif or display face (Fraunces, Playfair Display, Instrument Serif, DM Serif Display, Libre Baskerville); body in a readable serif (Lora, EB Garamond, Merriweather) or a clean sans (Inter, Source Sans 3). Large headline sizes (text-5xl to text-7xl) with tight leading.
- Body text 18-20 px (text-lg), leading-relaxed or leading-8, max width about 68 characters (max-w-[68ch]).

## Layout
- Home: a featured story with a large image and big headline, then a grid of posts with varied card sizes (one large, several small), category sections and a newsletter signup.
- Post cards: image (aspect-[3/2] rounded-lg overflow-hidden, subtle hover zoom), category eyebrow in the accent colour, headline, one-line excerpt, author avatar, date and reading time in muted text.
- Article page: category and date above a huge headline, a standfirst paragraph in larger muted text, author byline, a full-width cover image with a caption, then the text column. Use pull quotes (large italic serif with a left border in the accent colour), drop cap on the first paragraph (first-letter:text-6xl first-letter:float-left first-letter:mr-2 first-letter:font-display), figures with captions, and a table of contents for long pieces.
- Render markdown with react-markdown and style it: h2 text-3xl mt-12, p mb-6, a underline decoration-accent underline-offset-4, blockquote, lists, code blocks in a mono font on bg-muted.
- Navigation: a centred masthead with the publication name in the display font, categories below; on phones a Sheet menu.
- Footer: newsletter form, about text, categories, social links.

## Portfolios
- Big type and big work: project cards as large images with titles on hover, case study pages with full-bleed images and short captions, a simple about section with a portrait.

## Details
- Dates and numbers in small caps or tabular-nums. Thin rules (border-t border-border) to separate sections like a newspaper.
- Generous vertical spacing; let headlines breathe. Use italics for emphasis, not colour.
- Tags as small outline badges. Reading progress bar at the top of articles (a thin bar in the accent colour).

## Avoid
- Sans-serif-only bland blogs, cramped text, full-width long lines, coloured backgrounds behind text, heavy cards with shadows around every post, sidebars full of widgets.
