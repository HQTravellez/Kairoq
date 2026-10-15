---
name: Scroll stories (GSAP + Lenis)
description: Award-style scroll experiences: smooth scrolling with Lenis, pinned sections and scrubbed timelines with GSAP ScrollTrigger, horizontal scroll galleries and step-by-step product stories. Use for flagship landing pages.
---
# Scroll stories (GSAP + Lenis)

For the "agency-built" feel: buttery scrolling, sections that pin while a story plays, and animations scrubbed to the scroll position. Packages: `gsap` (free, including ScrollTrigger) and `lenis`.

## Setup (once, in a small hook)
```jsx
import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
export function useSmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(raf); gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); };
  }, []);
}
```
Call it in the marketing layout only, never inside the app screens or dialogs. With HashRouter, scroll to top on route change with `window.scrollTo(0,0)`.

## Patterns
- **Pinned story.** `useEffect(() => { const ctx = gsap.context(() => { gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: '+=200%', scrub: 0.6, pin: true } }).from('.step-2', { opacity: 0, y: 40 }).from('.step-3', { opacity: 0, y: 40 }); }, ref); return () => ctx.revert(); }, []);` Always use `gsap.context` and `ctx.revert()` so React cleans up.
- **Horizontal gallery.** Pin the section and move a wide track `x: () => -(track.scrollWidth - innerWidth)` with `scrub: true` and `invalidateOnRefresh: true`.
- **Scrubbed product shot.** Scale a device mockup from 0.85 to 1 and rotate it from 8deg to 0 as it enters.
- **Counters and progress lines** drawn with `strokeDashoffset` scrubbed along a timeline.

## Rules
- At most one or two pinned sections per page; everything must still read well without JavaScript or with reduced motion (content visible by default, animate `from` hidden only after mount).
- Disable pinning under 768 px (`ScrollTrigger.matchMedia` or a width check) — on phones use simple reveals instead.
- Test that the page does not scroll sideways at 390 px.
