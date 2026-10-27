import React from 'react';
import { cn } from '../../lib/utils.js';

// Page layout helpers with consistent widths and vertical rhythm.
export function Container({ className, ...props }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
export function Section({ className, ...props }) {
  return <section className={cn('py-16 sm:py-24', className)} {...props} />;
}
// A short lead-in line in sentence case (not tiny capitals). Kept for older pages; new pages
// rarely need it: a heading stands on its own.
export function Eyebrow({ className, ...props }) {
  return <p className={cn('text-sm font-medium text-muted-foreground', className)} {...props} />;
}
