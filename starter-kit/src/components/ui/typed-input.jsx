// TypedInput: the hero is the product's real input (search, booking, "ask"), with example requests
// typed into it one after another, so a visitor understands it in two seconds and can try it.
// Written for Kairoq's kit. Motion stops for visitors who ask for reduced motion, and while the
// field has focus or text.
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';

export function TypedInput({ examples = [], onSubmit, buttonLabel = 'Search', label = 'Search', className, inputClassName, speed = 45, pause = 1600, children, ...props }) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState(examples[0] || '');
  const [focused, setFocused] = useState(false);
  const still = useRef(false);
  useEffect(() => { still.current = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);
  useEffect(() => {
    if (!examples.length || still.current || focused || value) { setHint(examples[0] || ''); return undefined; }
    let i = 0, n = 0, del = false, timer;
    const tick = () => {
      const text = examples[i % examples.length];
      if (!del) { n += 1; setHint(text.slice(0, n)); if (n >= text.length) { del = true; timer = setTimeout(tick, pause); return; } }
      else { n -= 2; setHint(text.slice(0, Math.max(0, n))); if (n <= 0) { del = false; i += 1; n = 0; } }
      timer = setTimeout(tick, del ? speed / 2 : speed);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [examples.join('|'), focused, value, speed, pause]);
  const submit = e => { e.preventDefault(); const q = value.trim() || examples[0] || ''; if (onSubmit) onSubmit(q); };
  return (
    <form onSubmit={submit} className={cn('flex w-full items-center gap-2 rounded-lg border bg-background p-2 focus-within:ring-2 focus-within:ring-ring', className)} role="search" {...props}>
      <label className="sr-only" htmlFor="typed-input">{label}</label>
      <input
        id="typed-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={hint}
        aria-describedby={examples.length ? 'typed-input-examples' : undefined}
        className={cn('min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground', inputClassName)}
      />
      {children}
      <button type="submit" className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{buttonLabel}</button>
      {examples.length ? <span id="typed-input-examples" className="sr-only">For example: {examples.join('; ')}</span> : null}
    </form>
  );
}
export default TypedInput;
