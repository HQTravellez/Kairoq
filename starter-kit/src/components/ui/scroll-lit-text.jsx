// ScrollLitText: one large statement whose words light up as the visitor scrolls through it.
// Written for Kairoq's kit. With reduced motion the text is simply shown.
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return <motion.span style={{ opacity }} className="inline-block whitespace-pre">{children}</motion.span>;
}

export function ScrollLitText({ text = '', className, as: Tag = 'p' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = String(text).split(/(\s+)/).filter(Boolean);
  const count = words.filter(w => w.trim()).length || 1;
  let k = 0;
  return (
    <Tag ref={ref} className={cn('font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl', className)} aria-label={text}>
      {reduce ? text : words.map((w, i) => {
        if (!w.trim()) return <span key={i}>{w}</span>;
        const start = k / count, end = (k + 1) / count; k += 1;
        return <Word key={i} progress={scrollYProgress} range={[start, end]}>{w}</Word>;
      })}
    </Tag>
  );
}
export default ScrollLitText;
