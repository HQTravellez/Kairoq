// PinnedScroll: a section that pins to the screen while its panels slide sideways as the visitor
// scrolls, the GSAP ScrollTrigger "pin + scrub" idea on framer-motion. Written for Kairoq's kit.
// On phones and with reduced motion the panels simply stack, so nothing is hidden.
import { Children, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

function useWide(query = '(min-width: 768px)') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query), on = () => setWide(m.matches);
    on(); m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}

export function PinnedScroll({ children, className, panelClassName, label }) {
  const panels = Children.toArray(children);
  const n = Math.max(1, panels.length);
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const wide = useWide();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], ['0%', -((n - 1) * 100) / n + '%']);
  if (reduce || !wide || n === 1) {
    return (
      <section aria-label={label} className={cn('grid gap-12', className)}>
        {panels.map((p, i) => <div key={i} className={panelClassName}>{p}</div>)}
      </section>
    );
  }
  return (
    <section ref={ref} aria-label={label} className={cn('relative', className)} style={{ height: n * 100 + 'vh' }}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <motion.div style={{ x, width: n * 100 + '%' }} className="flex h-full will-change-transform">
          {panels.map((p, i) => (
            <div key={i} data-panel={i} className={cn('flex h-full items-center', panelClassName)} style={{ width: 100 / n + '%' }}>{p}</div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
export default PinnedScroll;
