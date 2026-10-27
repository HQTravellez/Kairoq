// ProductTour: shows how the product works by playing it, like a short demo: a frame with the
// business's own screens, a cursor that moves to the next thing and clicks, and one caption per
// step. Built in code, so it always matches the site. Plays when it scrolls into view; visitors
// can pause it or click a step. With reduced motion it shows the steps without the moving cursor.
// Written for Kairoq's kit.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { cn } from '../../lib/utils.js';

// steps: [{ caption: 'Pick the dates', screen: <YourScreen/>, cursor: { x: 70, y: 40 } (percent of
// the frame), click: true }]. frame: 'browser' | 'phone' | 'none'.
export function ProductTour({ steps = [], frame = 'browser', interval = 3200, className, title = 'How it works', address = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const [clicking, setClicking] = useState(false);
  useEffect(() => { setStill(Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)); }, []);
  useEffect(() => {
    if (!inView || paused || still || steps.length < 2) return undefined;
    const t1 = setTimeout(() => setClicking(Boolean(steps[i] && steps[i].click !== false)), interval * 0.55);
    const t2 = setTimeout(() => { setClicking(false); setI(n => (n + 1) % steps.length); }, interval);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [i, inView, paused, still, interval, steps.length]);
  if (!steps.length) return null;
  const step = steps[i];
  const cursor = step.cursor || { x: 60, y: 55 };
  const screen = (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={i} className="h-full w-full" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
          {step.screen}
        </motion.div>
      </AnimatePresence>
      {!still && (
        <motion.div aria-hidden="true" className="pointer-events-none absolute z-10" initial={false} animate={{ left: cursor.x + '%', top: cursor.y + '%' }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="hsl(var(--foreground))" stroke="hsl(var(--background))" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          {clicking && <motion.span className="absolute -left-3 -top-3 h-8 w-8 rounded-full border-2 border-primary" initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.5 }} />}
        </motion.div>
      )}
    </div>
  );
  return (
    <section ref={ref} className={cn('w-full', className)} aria-label={title}>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_2fr]">
        <ol className="order-2 space-y-1 lg:order-1">
          {steps.map((s, k) => (
            <li key={k}>
              <button type="button" onClick={() => { setI(k); setPaused(true); }} aria-current={k === i ? 'step' : undefined}
                className={cn('w-full border-l-2 py-3 pl-4 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', k === i ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                {s.caption}
              </button>
            </li>
          ))}
          {!still && steps.length > 1 && (
            <li><button type="button" onClick={() => setPaused(p => !p)} className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline">{paused ? 'Play' : 'Pause'}</button></li>
          )}
        </ol>
        <div className="order-1 lg:order-2">
          {frame === 'phone' ? (
            <div className="mx-auto aspect-[9/19] w-full max-w-[300px] overflow-hidden rounded-[2.2rem] border-[10px] border-foreground/90 bg-background">{screen}</div>
          ) : frame === 'none' ? (
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border">{screen}</div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-muted/40">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/15" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                {address ? <span className="ml-3 truncate text-xs text-muted-foreground">{address}</span> : null}
              </div>
              <div className="aspect-[16/10] w-full">{screen}</div>
            </div>
          )}
          <p className="sr-only" aria-live="polite">{step.caption}</p>
        </div>
      </div>
    </section>
  );
}
export default ProductTour;
