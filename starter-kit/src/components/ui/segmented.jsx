import React from 'react';
import { cn } from '../../lib/utils.js';

// Choosing one of 2 to 4 options that are always visible (Evenly / Custom shares / By item,
// Monthly / Yearly, Pickup / Delivery). For 5 or more options use Select.
//
// <Segmented label="How to split" value={mode} onChange={setMode} options={[{ value: 'even', label: 'Evenly' }, { value: 'item', label: 'By item' }]} />

export function Segmented({ label, value, onChange, options, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {label ? <p className="m-0 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p> : null}
      <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(max-content, 1fr))` }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                'h-9 whitespace-nowrap rounded-md px-2 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:text-sm',
                on ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
