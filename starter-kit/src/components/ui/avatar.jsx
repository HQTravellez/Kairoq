import React, { useState } from 'react';
import { cn } from '../../lib/utils.js';

// Shows the image, or the initials of `name` when there is no image or it fails to load.
export function Avatar({ src, name = '', className, ...props }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <span className={cn('relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground', className)} {...props}>
      {src && !failed ? <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : initials || '?'}
    </span>
  );
}
