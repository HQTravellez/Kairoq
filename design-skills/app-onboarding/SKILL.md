---
name: App onboarding
description: First-run onboarding screens for mobile and web apps with splash, value slides, permissions, sign-in and a short personalisation step.
group: Page types
---
# App onboarding

The first minute in an app decides whether people stay. Onboarding should explain the value in a few screens, ask only for what is needed, and get the user to their first useful moment fast: booking a table, seeing their stay details, picking a class.

## Purpose
- An onboarding flow shown on first launch (stored as a flag for the user) with steps defined in data: id, title, text, illustration or image, optional action. The user can skip at any time and can restart it from settings.
- A presentation view that shows the key screens side by side in phone frames for review.

## Screens
- Splash: logo centred on brand colour or a photo, a one-line promise, auto-advance after a short moment or on tap.
- Value slides (2-3): each with a large illustration or photo in the top 55%, a short headline (max 6 words), one sentence of text, page dots and Next / Skip. Swipe between them with a carousel (embla) or framer-motion drag.
- Personalisation (optional): 1 question with tappable chips ("What brings you here?" Dining, Stays, Spa, Events) to tailor the home screen.
- Permissions: explain the benefit before asking for notifications or location ("We will remind you an hour before your table"); provide "Not now".
- Sign in: email field with magic link or one-time code, social or platform sign-in buttons as neutral outline buttons with generic labels if the app supports them, a "Continue as guest" option when possible, and links to terms and privacy.
- Done: a welcome screen that leads straight to the first action, not an empty dashboard.

## Layout
- Phone viewport first: `min-h-dvh flex flex-col px-6 pt-safe pb-safe` (use `env(safe-area-inset-*)`); primary button full width at the bottom (`h-12 rounded-xl`), secondary as a text button above or beside it.
- Progress indicator: dots or a segmented top bar; the active one wider and in brand colour.
- On desktop, centre the flow in a card (`max-w-md`) or show a split layout with the image on the left.
- Phone frame presentation: three frames (`w-[300px] h-[620px] rounded-[44px] border-[10px] border-neutral-900`) in a row on a soft background, each showing one key screen.

## Palette and type
- Follow the app brand: soft background, strong primary for the main button, illustrations in the brand palette. Friendly sans (Figtree, DM Sans, Manrope); headlines text-3xl bold.

## Details
- Transitions: slide or fade between steps (200-300 ms), illustrations with a small parallax; disable for reduced motion.
- Accessibility: focus moves to each new step title, buttons have clear labels, dots are not the only way to navigate.
- Remember progress so a user who leaves mid-way resumes.

## Avoid
- More than four info slides, asking for permissions on the first screen, forcing account creation before showing value, tiny skip links, walls of text, and generic illustrations unrelated to the business.
