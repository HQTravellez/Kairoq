import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils.js';

// Wrap the app (or a section) in <TooltipProvider> once.
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = React.forwardRef(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-soft animate-fade-in', className)} {...props} />
  </TooltipPrimitive.Portal>
));
