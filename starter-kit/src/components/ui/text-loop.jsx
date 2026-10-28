// text-loop from Motion Primitives by ibelick (github.com/ibelick/motion-primitives, MIT). Converted to JSX for Kairoq's kit.
import { cn } from '../../lib/utils.js';
import {
  motion,
  AnimatePresence
} from 'framer-motion';
import { useState, useEffect, Children } from 'react';
function TextLoop({
  children,
  className,
  interval = 2,
  transition = { duration: 0.3 },
  variants,
  onIndexChange,
  trigger = true
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    if (!trigger) return;
    const intervalMs = interval * 1e3;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, trigger]);
  const motionVariants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 }
  };
  // Kairoq fix (the original used popLayout, which left an empty line): every word sits in one
  // grid cell; hidden copies of all of them keep the cell as wide as the longest, so the headline
  // never moves, and the leaving word goes before the next arrives (mode "wait").
  return <span className={cn("relative inline-grid whitespace-nowrap align-baseline", className)}>
      {items.map((item, i) => <span key={'w' + i} aria-hidden="true" className="invisible [grid-area:1/1]">{item}</span>)}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
    key={currentIndex}
    className="[grid-area:1/1]"
    initial='initial'
    animate='animate'
    exit='exit'
    transition={transition}
    variants={variants || motionVariants}
  >
          {items[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>;
}
export {
  TextLoop
};
