// in-view from Motion Primitives by ibelick (github.com/ibelick/motion-primitives, MIT). Converted to JSX for Kairoq's kit.
import { useRef, useState } from 'react';
import {
  motion,
  useInView
} from 'framer-motion';
const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};
function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = "div",
  once
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);
  const MotionComponent = motion[as];
  return <MotionComponent
    ref={ref}
    initial='hidden'
    onAnimationComplete={() => {
      if (once) setIsViewed(true);
    }}
    animate={isInView || isViewed ? "visible" : "hidden"}
    variants={variants}
    transition={transition}
  >
      {children}
    </MotionComponent>;
}
export {
  InView
};
