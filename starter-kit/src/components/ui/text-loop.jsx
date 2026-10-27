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
  // The leaving and the arriving word share one grid cell, so the swap never pops a word out of
  // the line or leaves an empty line under the headline (Kairoq fix; the original used popLayout).
  return <span className={cn("relative inline-grid whitespace-nowrap align-baseline", className)}>
      <AnimatePresence initial={false}>
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
