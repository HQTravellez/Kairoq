---
name: Framer-style motion
description: The polished motion of sites built in Framer: scroll-linked reveals, sticky scroll stories, layout animations, spring hovers, text reveals, marquees and number tickers, with framer-motion. Use on marketing sites and product tours.
---
# Framer-style motion (framer-motion)

Framer sites feel alive because motion is tied to scroll and to the content, uses springs instead of linear easing, and happens once. Use the `framer-motion` package (already available).

## Patterns
- **Reveal on scroll, once.** `<motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-80px'}} transition={{type:'spring',stiffness:120,damping:20}}>`. Stagger children with `transition={{delay:i*0.06}}` or a parent `variants` with `staggerChildren:0.06`.
- **Headline text reveal.** Split the headline into words (`text.split(' ')`), wrap each in `overflow-hidden inline-block`, animate an inner span from `y:'110%'` to `0` with a 0.04 s stagger.
- **Scroll-linked values.** `const ref=useRef(); const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']}); const y=useTransform(scrollYProgress,[0,1],[60,-60]);` Use this for gentle parallax on a product shot, a progress bar on a timeline, or a scale-up of a device mockup (0.9 → 1).
- **Sticky scroll story.** A tall section (`h-[300vh]`) with a `sticky top-0 h-screen` child. Map `scrollYProgress` to which of 3-4 steps is active and cross-fade the product panel while the text on the left changes. Great for "how it works".
- **Layout animations.** Tabs and segmented controls with a moving highlight: `<motion.span layoutId="tab-pill" />` inside the active tab. Expanding cards with `layout` and `AnimatePresence`.
- **Springy hover.** `whileHover={{y:-4}} whileTap={{scale:0.98}} transition={{type:'spring',stiffness:400,damping:25}}` on cards and buttons. A magnetic button nudges toward the pointer by 10-20%.
- **Number tickers.** Animate from 0 to the value once in view with `useMotionValue` + `animate(mv, value, {duration:1.2})` and render `Math.round(latest)` with tabular-nums.
- **Marquee.** Two copies of a row in a flex container animated `x: ['0%','-50%']` with `repeat:Infinity, ease:'linear', duration:30`; pause on hover. Use for real partner names or product features, never fake logos.
- **Live demo feel.** Rows that appear one by one in a product mockup (a trip being assembled, messages arriving), with `AnimatePresence` and a typing caret for the input.

## Rules
- Respect `prefers-reduced-motion`: `const reduce=useReducedMotion()` and skip transforms when true.
- Animate transform and opacity only. Durations 0.3-0.8 s; springs for anything interactive.
- One hero moment per page; the rest is quiet. Never animate body text paragraphs one letter at a time.
