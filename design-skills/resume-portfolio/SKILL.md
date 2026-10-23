---
name: Resume and profile
description: Printable CV and personal profile pages for owners, chefs, freelancers and team members, with clean A4 layout and a web version.
group: Page types
---
# Resume and profile

A CV or profile page should let a reader understand who someone is and what they have done in thirty seconds. Use it for a freelancer's portfolio site, a chef or therapist bio, team member pages for an agency, or a downloadable A4 CV.

## Purpose
- A `Resume` component driven by structured data: name, title, summary, contact items, experience (role, organisation, place, start, end, bullet achievements), education, skills, languages, certifications, awards and selected projects.
- Two outputs from the same data: a responsive web profile page and an A4 print layout for PDF via `window.print()`.

## Layout
- A4 container on screen: `mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white p-[18mm] shadow`.
- Header: name large (`text-4xl font-semibold tracking-tight`), title in muted text, then one line of contact items (email, phone, city, website, portfolio) separated by thin vertical dividers or middots. Optional round portrait on the right.
- Summary: 2-3 sentences, no buzzwords.
- Main grid: `grid grid-cols-[1.6fr_1fr] gap-10`. Left: Experience, Projects, Education. Right: Skills (grouped tags), Languages (with level), Certifications, Awards, Interests.
- Section titles in small caps or uppercase tracking with a short accent bar above (`before:block before:w-8 before:h-0.5 before:bg-[hsl(var(--brand))]`).
- Experience entries: role and organisation on one line, dates right-aligned in tabular numbers, place in muted text, then 1-3 bullets that start with a verb and include a result ("Raised repeat bookings by a third").
- Web profile version: a hero with portrait and short intro, a timeline of experience, a project gallery with images, testimonials, and a contact button.

## Palette and type
- Black, greys and white with one accent (deep blue #1e3a8a, forest #1f4d3a or burgundy #7a1f2b).
- Clean sans (Inter, IBM Plex Sans, Source Sans 3) at 10-10.5 pt in print; optionally a serif for the name.

## Print CSS
- `@page { size: A4; margin: 0 }`, `@media print { .no-print { display: none } .resume { box-shadow: none } }`, keep accent colours with `print-color-adjust: exact`.
- `break-inside: avoid` on each experience entry; keep to one or two pages.
- Links print with their URL shown in small text (`a[href]::after { content: " (" attr(href) ")" }` only for print, or show short URLs directly).

## Details
- Dates formatted consistently (Mar 2022 - Present). Durations computed from data if shown.
- Semantic headings and lists so screen readers and applicant systems can parse the text; avoid putting text in images.
- A "Download PDF" and "Copy link" toolbar hidden in print.

## Avoid
- Skill bars with percentages, multiple colours, icons for every line, two-column layouts that break in print, photos when the region discourages them, and tiny 8 pt text.
