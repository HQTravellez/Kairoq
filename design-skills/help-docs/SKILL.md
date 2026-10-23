---
name: Help center and docs
description: Help center and documentation pages with sidebar navigation, search, step-by-step guides, callouts and an on-page table of contents.
group: Page types
---
# Help center and docs

Documentation is read by people who are stuck. They want the answer fast, then to get back to work. Design for scanning, searching and following steps: guest FAQs for a hotel, a staff handbook, a booking system help center, product setup guides, API docs for an agency's client.

## Purpose
- A docs section with articles stored as markdown or MDX in the app (title, slug, category, order, updated date, body). Render with react-markdown plus remark-gfm, and syntax highlighting for code if needed.
- Search across titles and headings (a client-side index with a small fuzzy search such as fuse.js), opened with a Command dialog (Ctrl or Cmd + K).

## Layout
- Three columns on desktop: left sidebar navigation (`w-64 sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto`), article (`max-w-3xl`), right "On this page" table of contents (`w-56 sticky`). On tablets hide the right column; on phones the sidebar becomes a Sheet with a menu button.
- Top bar: logo, "Help center" label, search trigger styled as an input with the shortcut hint, optional version or language select, theme toggle, and a "Contact support" button.
- Help center home: a big search field in a hero, category cards in a grid (icon, title, 1-line description, article count), popular articles list, and a contact block.
- Article: breadcrumb, title, short summary, updated date and reading time, then content. End with "Was this helpful?" thumbs (saved to data), previous and next links, and related articles.
- Steps: numbered steps with a vertical connector line (`relative pl-10` with a circle counter), each with a short title, text and an optional screenshot in a bordered frame.

## Components
- Callouts: Info, Tip, Warning, Danger with a lucide icon, left border and soft tinted background (`border-l-4 bg-blue-500/5` etc.). Use them sparingly.
- Code blocks: dark rounded panel, language label, copy button with "Copied" feedback, horizontal scroll, no wrapping.
- Tables with clean borders for settings or opening hours; keyboard keys as `<kbd>` badges.
- Headings get anchor links (hover shows a `#` icon); the TOC highlights the current section with IntersectionObserver (scroll spy).

## Palette and type
- Calm neutral theme with brand colour for links, the active nav item and focus rings. Body 16-17 px, leading-7, comfortable line length.
- Sans for UI and text (Inter, Source Sans 3), mono for code (JetBrains Mono).

## Details
- Every article has one clear H1 and logical H2/H3; URLs are readable slugs.
- Search results show the category and a matching snippet; empty results suggest contacting support.
- Print-friendly: `@media print` hides navigation and TOC and expands collapsed sections.

## Avoid
- Marketing heroes on article pages, long paragraphs without headings, screenshots without context, nested accordions that hide answers, low-contrast grey text, and fixed elements that cover content on phones.
