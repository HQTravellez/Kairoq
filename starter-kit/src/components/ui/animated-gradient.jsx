// AnimatedGradient: soft moving colour glows behind a section (absolute, fills its parent).
// From Cult UI (github.com/nolly-studio/cult-ui, MIT); converted to JSX, defaults from the theme.
import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
// Defaults use the app's own colours (design tokens), so <AnimatedGradient /> works on its own.
const THEME = [
  { centerX: 20, centerY: 30, stops: [{ color: 'hsl(var(--primary) / 0.35)', position: 0 }, { color: 'transparent', position: 55 }] },
  { centerX: 80, centerY: 70, stops: [{ color: 'hsl(var(--accent) / 0.35)', position: 0 }, { color: 'transparent', position: 55 }] },
  { centerX: 50, centerY: 20, stops: [{ color: 'hsl(var(--primary) / 0.25)', position: 0 }, { color: 'transparent', position: 60 }] },
];
const GradientAnimation = ({
  gradients = THEME,
  animationDuration = 12,
  className = ""
}) => {
  const controls = useAnimation();
  useEffect(() => {
    controls.start({
      background: gradients.map(
        (g) => `radial-gradient(circle at ${g.centerX}% ${g.centerY}%, ${g.stops.map((s) => `${s.color} ${s.position}%`).join(", ")})`
      ),
      transition: {
        duration: animationDuration,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "linear"
      }
    });
  }, [controls, gradients, animationDuration]);
  return <motion.div
    className={`absolute inset-0 h-full w-full ${className}`}
    animate={controls}
  />;
};
const AnimatedGradient = React.memo(GradientAnimation);
export { AnimatedGradient, GradientAnimation };
export default AnimatedGradient;
