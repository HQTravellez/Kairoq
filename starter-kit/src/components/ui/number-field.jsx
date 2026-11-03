import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// A number people type or pick: a label, the field (with a $ or % beside it), and quick picks
// under it (10% 15% 18% 20% 25%). The picked preset is highlighted; typing any other value works too.
//
// <NumberField label="Tip" suffix="%" value={tip} onChange={setTip} presets={[10, 15, 18, 20, 25]} />
// <NumberField label="Bill amount" prefix="$" value={bill} onChange={setBill} min={0} step={0.01} />
// value is a number (or '' while the field is empty); onChange gets a number or ''.

export function NumberField({ label, id, value, onChange, prefix, suffix, presets, presetLabel = (p) => p + (suffix || ''), min, max, step = 1, placeholder, hint, className }) {
  const autoId = React.useId();
  const fieldId = id || autoId;
  const set = (v) => onChange(v === '' ? '' : Number(v));
  return (
    <div className={cn('space-y-2', className)}>
      {label ? <label htmlFor={fieldId} className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label> : null}
      <div className="flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3 transition-colors focus-within:ring-2 focus-within:ring-ring">
        {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
        <input
          id={fieldId}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => set(e.target.value)}
          className="w-full bg-transparent text-base tabular-nums text-foreground outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      </div>
      {presets && presets.length ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` }} role="group" aria-label={label ? label + ' quick picks' : 'Quick picks'}>
          {presets.map((p) => {
            const on = Number(value) === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(p)}
                className={cn(
                  'h-9 rounded-md text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'
                )}
              >
                {presetLabel(p)}
              </button>
            );
          })}
        </div>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// A count with − and + (people, nights, tickets). Stays within min and max.
// <Stepper label="Number of people" value={people} onChange={setPeople} min={1} max={20} />
export function Stepper({ label, id, value, onChange, min = 0, max = Infinity, step = 1, className }) {
  const autoId = React.useId();
  const fieldId = id || autoId;
  const n = Number(value) || 0;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div className={cn('space-y-2', className)}>
      {label ? <label htmlFor={fieldId} className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label> : null}
      <div className="flex h-11 items-stretch overflow-hidden rounded-md border border-input bg-background">
        <button type="button" aria-label={'Fewer' + (label ? ' ' + label.toLowerCase() : '')} disabled={n <= min} onClick={() => onChange(clamp(n - step))} className="grid w-11 place-items-center border-r border-input text-foreground transition-colors hover:bg-muted disabled:opacity-40">
          <Minus className="h-4 w-4" />
        </button>
        <input id={fieldId} type="number" inputMode="numeric" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value === '' ? '' : clamp(Number(e.target.value)))} className="w-full bg-transparent text-center text-base font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <button type="button" aria-label={'More' + (label ? ' ' + label.toLowerCase() : '')} disabled={n >= max} onClick={() => onChange(clamp(n + step))} className="grid w-11 place-items-center border-l border-input text-foreground transition-colors hover:bg-muted disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
