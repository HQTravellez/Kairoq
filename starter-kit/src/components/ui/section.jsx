import React from 'react';
import { cn } from '../../lib/utils.js';

// Page layout helpers with consistent widths and vertical rhythm.
export function Container({ className, ...props }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
export function Section({ className, ...props }) {
  return <section className={cn('py-16 sm:py-24', className)} {...props} />;
}
export function Eyebrow({ className, ...props }) {
  return <p className={cn('text-xs font-semibold uppercase tracking-[0.2em] text-primary', className)} {...props} />;
}
