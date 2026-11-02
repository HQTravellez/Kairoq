// Parallax: a photo band (or any layer) that moves slower than the page as the visitor scrolls,
// the GSAP ScrollTrigger "scrub" idea on framer-motion. Written for Kairoq's kit. With reduced
// motion the photo simply stands still.
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

// A full-width photo band: the photo drifts by `speed` (0.1 subtle to 0.4 strong) while the band
// scrolls past; children sit on top (put text on a dark overlay so it reads).
export function ParallaxImage({ src, alt = '', speed = 0.25, className, imgClassName, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const shift = Math.max(0, Math.min(0.5, Number(speed) || 0)) * 100;
  const y = useTransform(scrollYProgress, [0, 1], [-shift / 2 + '%', shift / 2 + '%']);
  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      <motion.img src={src} alt={alt} loading="lazy" style={reduce ? undefined : { y, scale: 1 + shift / 100 }}
        className={cn('absolute inset-0 h-full w-full object-cover will-change-transform', imgClassName)} />
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

// Any element that drifts against the scroll: positive speed moves it up faster, negative lags.
export function Parallax({ speed = 0.15, className, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const px = Math.max(-1, Math.min(1, Number(speed) || 0)) * 160;
  const y = useTransform(scrollYProgress, [0, 1], [px, -px]);
  return <motion.div ref={ref} style={reduce ? undefined : { y }} className={cn('will-change-transform', className)}>{children}</motion.div>;
}
export default ParallaxImage;
