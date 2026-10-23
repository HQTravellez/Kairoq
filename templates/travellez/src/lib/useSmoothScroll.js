import { useEffect } from 'react';
import Lenis from 'lenis';

// Gentle smooth scrolling on the marketing pages (off with reduced motion and on touch screens).
export default function useSmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return;
    const lenis = new Lenis({ lerp: 0.12 });
    let id;
    const raf = (t) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);
}
