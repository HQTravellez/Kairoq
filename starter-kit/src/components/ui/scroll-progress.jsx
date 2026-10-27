// scroll-progress from Motion Primitives by ibelick (github.com/ibelick/motion-primitives, MIT). Converted to JSX for Kairoq's kit.
import { motion, useScroll, useSpring } from 'framer-motion';
import { cn } from '../../lib/utils.js';
const DEFAULT_SPRING_OPTIONS = {
  stiffness: 200,
  damping: 50,
  restDelta: 1e-3
};
function ScrollProgress({
  className,
  springOptions,
  containerRef
}) {
  const { scrollYProgress } = useScroll({
    container: containerRef,
    layoutEffect: Boolean(containerRef?.current)
  });
  const scaleX = useSpring(scrollYProgress, {
    ...DEFAULT_SPRING_OPTIONS,
    ...springOptions ?? {}
  });
  return <motion.div
    className={cn("inset-x-0 top-0 h-1 origin-left", className)}
    style={{
      scaleX
    }}
  />;
}
export {
  ScrollProgress
};
