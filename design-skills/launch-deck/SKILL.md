---
name: Launch deck
description: Product or offer launch slides with a dramatic dark stage, hero reveal, feature cards, plan options and a clear available-now call to action.
group: Page types
---
# Launch deck

A launch deck is a show: it builds anticipation, reveals the new thing and leaves people wanting to act. Use it for a new menu, a renovated suite, a new collection in a shop, a membership, an app or a service package, presented on stage, in a store window screen or as a shareable web page.

## Purpose
- Slides from data (type, title, text, image, features, plans, CTA) in a 16:9 stage that scales to fit, with the same keyboard, touch and hash navigation as a presentation deck. Pricing or offer values are always read from the app's data.
- Also usable as a scrolling launch page: each slide becomes a full-height section with scroll-triggered reveals.

## Story
1. Cover: dark background, a single large line ("Something new is coming to the terrace"), date.
2. Why we built this: the guest or customer problem in one sentence and a photo.
3. Introducing: the product name huge, with one hero shot that scales up slightly as it appears.
4. Features: 3-6 cards with icon, short title and one line, revealed one by one.
5. Detail moments: full-bleed images with a short caption (material, flavour, view, experience).
6. Options or plans: 2-3 tiers as cards with names, what is included and price from data.
7. Social proof or first reactions: short quotes.
8. Available now: date, where to get it, button or QR code, and website.

## Palette and type
- Dark stage (#0b0b0f or deep brand tone) with white type and a warm accent gradient (orange to peach, coral to pink, or the brand's own pair) used for the product name, key words and glows.
- Large display sans (Inter Tight, Space Grotesk, Manrope ExtraBold) with tight tracking for titles at 96-160 px; body 28-36 px in soft grey.
- Images on dark backgrounds with soft radial light behind the product (`bg-[radial-gradient(...)]`).

## Motion
- framer-motion entrance animations per slide: titles rise and fade, hero images scale from 0.96 to 1, feature cards stagger by 80 ms. Gradients shimmer subtly on the product name.
- Keep durations short (300-600 ms) and disable for reduced motion. Nothing auto-plays sound.

## Details
- Fixed design size (1920 x 1080), scale wrapper, slide counter and progress bar; overview grid with O; fullscreen with F.
- Print to PDF with one slide per page using `@page { size: 1920px 1080px; margin: 0 }` and `break-after: page`; disable animations in print.
- Every claim is concrete ("Opens 1 June", "6 new rooms"), read from data where it is a fact that can change.

## Avoid
- Light grey slides with bullet lists, more than one gradient pair, long paragraphs, spinning or bouncing effects, unreadable small captions on images, and hard-coded prices.
