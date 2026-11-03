import React from 'react';
import { cn } from '../../lib/utils.js';

// The answer of a calculator or quote, as the one thing the eye lands on: a small label, a big
// number, and the lines that make it up. Updates as people type; no "Calculate" button needed.
//
// <ResultPanel label="Each person pays" value={formatMoney(each)} rows={[{ label: 'Tip', value: formatMoney(tip) }, { label: 'Total', value: formatMoney(total), strong: true }]} onReset={reset} />

export function ResultPanel({ label, value, note, rows = [], onReset, resetLabel = 'Reset', tone = 'dark', className }) {
  const dark = tone === 'dark';
  return (
    <div className={cn('rounded-lg p-6', dark ? 'bg-foreground text-background' : 'border bg-card text-card-foreground', className)} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-xs font-medium uppercase tracking-wide', dark ? 'text-background/70' : 'text-muted-foreground')}>{label}</p>
        {onReset ? (
          <button type="button" onClick={onReset} className={cn('rounded-md px-2 py-1 text-xs font-medium transition-colors', dark ? 'text-background/70 hover:bg-background/10 hover:text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            {resetLabel}
          </button>
        ) : null}
      </div>
      <p className="mt-2 font-display text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">{value}</p>
      {note ? <p className={cn('mt-1 text-sm', dark ? 'text-background/70' : 'text-muted-foreground')}>{note}</p> : null}
      {rows.length ? (
        <dl className={cn('mt-5 space-y-2 border-t pt-4 text-sm', dark ? 'border-background/15' : 'border-border')}>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <dt className={dark ? 'text-background/70' : 'text-muted-foreground'}>{r.label}</dt>
              <dd className={cn('tabular-nums', r.strong && 'font-semibold')}>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
