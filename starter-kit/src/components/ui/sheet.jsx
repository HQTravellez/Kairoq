import React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// A panel that slides in from an edge: mobile menus, filters, carts, bottom sheets.
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sides = {
  right: 'inset-y-0 right-0 h-full w-[85%] max-w-sm border-l animate-slide-in-right',
  left: 'inset-y-0 left-0 h-full w-[85%] max-w-sm border-r animate-slide-in-left',
  bottom: 'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-slide-up',
  top: 'inset-x-0 top-0 border-b animate-fade-in',
};

export const SheetContent = React.forwardRef(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 animate-fade-in" />
    <SheetPrimitive.Content ref={ref} className={cn('fixed z-50 flex flex-col gap-4 overflow-y-auto bg-card p-6 text-card-foreground shadow-glow', sides[side], className)} {...props}>
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
));
export const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn('font-display text-lg font-semibold', className)} {...props} />
));
export const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
