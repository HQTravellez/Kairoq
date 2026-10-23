---
name: Luxury hospitality
description: Boutique hotels, villas, restaurants, spas, wineries and tours. Warm editorial look with big photography, serif headlines and calm booking flows.
---
# Luxury hospitality

The site should feel like the printed brochure of a beautiful small hotel: calm, generous, photographic, confident. Guests decide with their eyes first, so imagery and typography carry the page.

## Palette and type
- Warm, natural palettes: sand, terracotta, olive, sea blue, deep ink. Background is an off-white (for example #faf7f2 or #f6f1ea), never pure white; foreground a soft ink (#1f1b16, #1c2430).
- Primary is a rich, earthy colour (terracotta #b4532a, olive #5b6b3a, deep sea #1f4e5f). Accent is a muted metallic or warm tone (#c8a96a brass, #d9a679 sand).
- Headings in a refined serif (Cormorant Garamond, Playfair Display, Fraunces or Instrument Serif); text in a quiet sans (DM Sans, Manrope, Figtree). Large headlines use font-light or font-normal, not bold.
- Small uppercase eyebrows with wide tracking (text-xs uppercase tracking-[0.25em]) above section titles.
- Radius small to medium (0.25rem to 0.75rem): elegant, not bubbly.

## Layout
- Hero: full-bleed photo (min-h-[85vh], object-cover) with a dark gradient overlay from the bottom (bg-gradient-to-t from-black/60), the property name in a large serif, one line of poetry, and a single "Check availability" button. A slim transparent nav on top that turns solid on scroll.
- Alternate image and text in two-column sections (lg:grid-cols-2, image aspect-[4/5] rounded), with lots of whitespace (py-24 lg:py-32).
- Rooms or experiences as large cards: photo aspect-[4/3] with hover:scale-105 inside overflow-hidden, name in serif, 2-3 amenities as small icons with labels, "from 140 €/night" in muted text, a quiet text link "View room →".
- A photo gallery as a masonry-like grid (columns-2 md:columns-3 gap-4 with break-inside-avoid) or a carousel (embla) with large slides.
- Include trust and place: a short story about the owners, guest quotes in large italic serif, a map or "how to get here" section, awards or press logos in muted grey.
- Footer: dark band (bg-foreground text-background) with address, phone, email, social links and a newsletter field.

## Booking flows
- A sticky booking bar on desktop (dates, guests, "Check availability") and a bottom sticky button on phones.
- Date pickers with react-day-picker in a popover; show nights and the total price live.
- Confirmation screens feel personal: "We look forward to welcoming you, Ana." with the dates in a summary card.

## Imagery
- Real, warm photography: rooms in daylight, details (linen, tiles, coffee), the view, the neighbourhood. Prefer wide shots for heroes and close-ups for detail sections.
- Never use icons or illustrations as the main visual; photos carry the page.

## Motion and details
- Slow, soft entrance animations (fade-up, 600 to 800 ms). Image hover zoom over 700 ms.
- Thin dividers (border-border/60), small caps labels, numbers in tabular-nums.
- Copy: warm, sensory and concise ("Wake up to the river light"). No exclamation marks, no salesy language.

## Avoid
- Bright saturated blues, neon gradients, heavy drop shadows, bold sans headlines, stock icons in circles, cramped cards.
