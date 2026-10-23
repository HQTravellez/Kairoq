import React from 'react';
import { cn } from '../../lib/utils.js';

// A loading placeholder: <Skeleton className="h-4 w-32" />
export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
