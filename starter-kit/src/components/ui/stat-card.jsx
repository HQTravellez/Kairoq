import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// A dashboard number (KPI): label, big value, change badge and a line of context. The layout
// follows the overview cards of next-shadcn-dashboard-starter by Kiranism (MIT).
//
// <StatCard label="Pipeline value" value="$48,200" change={12.5} note="vs last month" />
// change: a percentage (positive is good, unless goodWhen="down", for costs or churn).
// value may be a NumberTicker from './motion.jsx' for a count-up.

export function StatGrid({ className, ...props }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} {...props} />;
}

export function StatCard({ label, value, change, note, goodWhen = 'up', icon: Icon, className }) {
  const hasChange = typeof change === 'number' && Number.isFinite(change);
  const up = hasChange && change >= 0;
  const good = hasChange && (goodWhen === 'down' ? !up : up);
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {hasChange ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
              good ? 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400' : 'border-destructive/30 text-destructive'
            )}
          >
            <Trend className="h-3.5 w-3.5" aria-hidden="true" />
            {(up ? '+' : '') + change.toFixed(1)}%
            <span className="sr-only">{up ? 'up' : 'down'}</span>
          </span>
        ) : (
          Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
