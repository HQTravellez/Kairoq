import React from 'react';
import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Motion pieces for landing pages, adapted from Magic UI (magicui.design, MIT) to Tailwind 3,
// framer-motion and this app's design tokens. Each one holds still for people who prefer reduced
// motion. Use one or two per page, where they show something real; not everything should move.
//
// Marquee {reverse, pauseOnHover, vertical, repeat}: a row that scrolls forever (partners the owner
//   named, real quotes, product photos).
// NumberTicker {value, decimals, prefix, suffix}: counts up to a real number when it scrolls into view.
// BentoGrid / BentoCard {name, description, icon, href, cta, background, className}: a feature grid
//   with cards of different sizes (className="lg:col-span-2" for a wide one).
// BorderBeam {duration, borderWidth}: a light that runs around a card's border (the card needs
//   className="relative overflow-hidden"); for the one card that matters, such as a pricing plan.
// ShimmerButton: the hero's main call to action, with a moving shine.
// AnimatedList {delay}: items that arrive one by one, like live notifications or new orders.

export function Marquee({ className, reverse = false, pauseOnHover = false, vertical = false, repeat = 4, children, ...props }) {
  const still = useReducedMotion();
  return (
    <div
      {...props}
      className={cn('group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]', vertical ? 'flex-col' : 'flex-row', className)}
    >
      {Array.from({ length: still ? 1 : repeat }, (_, i) => (
        <div
          key={i}
          aria-hidden={i > 0 ? 'true' : undefined}
          className={cn(
            'flex shrink-0 justify-around [gap:var(--gap)]',
            vertical ? 'flex-col' : 'flex-row',
            !still && (vertical ? 'animate-marquee-vertical' : 'animate-marquee'),
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]'
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

export function NumberTicker({ value, startValue = 0, delay = 0, decimals = 0, prefix = '', suffix = '', locale = 'en-US', className, ...props }) {
  const ref = React.useRef(null);
  const still = useReducedMotion();
  const motionValue = useMotionValue(still ? value : startValue);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const inView = useInView(ref, { once: true, margin: '0px' });
  const format = React.useCallback(
    (n) => prefix + new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(n.toFixed(decimals))) + suffix,
    [prefix, suffix, decimals, locale]
  );

  React.useEffect(() => {
    if (!inView) return undefined;
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [inView, value, delay, motionValue]);

  React.useEffect(() => spring.on('change', (latest) => { if (ref.current) ref.current.textContent = format(latest); }), [spring, format]);

  return (
    <span ref={ref} className={cn('inline-block tabular-nums tracking-tight', className)} {...props}>
      {format(still ? value : startValue)}
    </span>
  );
}

export function BentoGrid({ className, children, ...props }) {
  return (
    <div className={cn('grid w-full auto-rows-[minmax(12rem,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className)} {...props}>
      {children}
    </div>
  );
}

// background: a picture or a small piece of the real product shown at the top of the card.
export function BentoCard({ name, description, icon: Icon, href, cta = 'Learn more', background, className, ...props }) {
  return (
    <div
      className={cn('group flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow', className)}
      {...props}
    >
      {background && <div className="relative min-h-[10rem] flex-1 overflow-hidden border-b bg-muted/40">{background}</div>}
      <div className={cn('flex flex-col gap-1 p-6', !background && 'h-full')}>
        {Icon && <span className="mb-auto pb-4"><Icon className="h-9 w-9 text-primary" aria-hidden="true" /></span>}
        <h3 className="font-display text-xl font-semibold tracking-tight">{name}</h3>
        {description && <p className="max-w-lg text-sm text-muted-foreground">{description}</p>}
        {href && (
          <a href={href} className="mt-3 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

// A light that runs around the border: a rotating gradient, masked so only the border shows.
export function BorderBeam({ duration = 6, borderWidth = 2, colorFrom = 'hsl(var(--primary))', colorTo = 'hsl(var(--accent))', className }) {
  const still = useReducedMotion();
  if (still) return null;
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      style={{
        padding: borderWidth,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[200%]"
        style={{ x: '-50%', y: '-50%', background: 'conic-gradient(from 0deg, transparent 0deg 280deg, ' + colorTo + ' 320deg, ' + colorFrom + ' 355deg, transparent 360deg)' }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration }}
      />
    </div>
  );
}

export const ShimmerButton = React.forwardRef(({ className, children, shimmerColor = 'hsl(var(--primary-foreground))', ...props }, ref) => {
  const still = useReducedMotion();
  return (
    <button
      ref={ref}
      style={{ '--shimmer-color': shimmerColor }}
      className={cn(
        'group relative z-0 inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50',
        className
      )}
      {...props}
    >
      {!still && (
        <span aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer-slide bg-gradient-to-r from-transparent via-[var(--shimmer-color)] to-transparent opacity-30" />
        </span>
      )}
      {children}
    </button>
  );
});
ShimmerButton.displayName = 'ShimmerButton';

export function AnimatedList({ children, delay = 1000, className, ...props }) {
  const still = useReducedMotion();
  const items = React.useMemo(() => React.Children.toArray(children), [children]);
  const [count, setCount] = React.useState(still ? items.length : 1);

  React.useEffect(() => {
    if (still || count >= items.length) return undefined;
    const timer = setTimeout(() => setCount((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [count, items.length, delay, still]);

  const shown = items.slice(0, count).reverse();
  return (
    <div className={cn('flex flex-col items-center gap-3', className)} {...props}>
      <AnimatePresence initial={false}>
        {shown.map((item) => (
          <motion.div
            key={item.key}
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, originY: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 40 }}
            className="w-full"
          >
            {item}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
