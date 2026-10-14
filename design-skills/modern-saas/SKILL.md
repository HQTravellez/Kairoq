---
name: Modern SaaS
description: Startup and SaaS landing pages, pricing pages and product sites. Crisp, confident, product-first design with strong hierarchy and polished details.
---
# Modern SaaS

Think of the best product launches: one sharp promise, the product shown big, proof, and a clear path to sign up. Every section earns its place.

## Palette and type
- Either a crisp light theme (background #ffffff or #fafafa, foreground #0a0a0a) or a deep dark theme (background #09090b, foreground #fafafa). Pick based on the audience: developer tools and AI products suit dark; business tools suit light.
- One vivid primary (indigo #4f46e5, violet #7c3aed, emerald #059669, orange #ea580c) and an accent that makes a good gradient with it.
- Headings in a geometric or grotesk sans (Inter, Plus Jakarta Sans, Bricolage Grotesque, Space Grotesk, Sora) with font-semibold and tracking-tight; text in Inter or DM Sans.
- Radius 0.5rem to 0.75rem.

## Page structure
1. Nav: logo, 3-5 links, "Sign in" ghost button and a primary "Get started" button. Sticky with backdrop-blur and a bottom border when scrolled.
2. Hero: small pill badge ("New: AI invoices →"), a 2-line headline (text-5xl lg:text-7xl), one sentence of value, two buttons (primary + outline), a line of social proof (avatars + "Trusted by 2,000 freelancers"). Below, a large product mockup: a browser frame (rounded-xl border shadow-glow) containing a realistic UI built with real components and numbers, not a grey box.
3. Logo cloud of customers in muted grey.
4. Features: a bento grid (grid-cols-6 with cards spanning 2, 3 or 4 columns) mixing small UI previews, metrics and icons; or alternating text and screenshots.
5. How it works in 3 numbered steps.
6. Testimonials with real-sounding names, roles, photos and specific results.
7. Pricing: 3 plans, the middle one highlighted (ring-2 ring-primary, "Most popular" badge), monthly/yearly toggle, feature lists with check icons, clear CTAs.
8. FAQ accordion, then a final call to action band (bg-gradient-hero text-primary-foreground rounded-2xl).
9. Footer with columns of links.

## Details that make it look premium
- Subtle background texture: a radial gradient glow behind the hero (absolute blurred circle bg-primary/20 blur-3xl) or a faint grid pattern made with a CSS background.
- Gradient text on one key word (bg-gradient-hero bg-clip-text text-transparent).
- Numbers that matter: "Save 6 hours a week", "99.9% uptime". Use tabular-nums.
- Cards with border plus shadow-soft, lifting on hover. Icons from lucide-react inside small rounded-lg squares tinted bg-primary/10 text-primary.
- Copy is specific and active ("Send invoices in 30 seconds"), never vague ("Revolutionize your workflow").

## In-app screens
- Left sidebar navigation, top bar with search and the user menu, content in cards on bg-muted/40.
- Empty states with an illustration-like icon, one sentence and a primary action.

## Avoid
- Generic blue (#3b82f6) everything, stock photos of people pointing at laptops, centred walls of text, more than one gradient style, lorem ipsum, fake 5-star widgets.
