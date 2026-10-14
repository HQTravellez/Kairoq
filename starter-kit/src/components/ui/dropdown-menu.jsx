import React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils.js';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 6, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-glow animate-fade-in', className)} {...props} />
  </MenuPrimitive.Portal>
));
export const DropdownMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <MenuPrimitive.Item ref={ref} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props} />
));
export const DropdownMenuLabel = ({ className, ...props }) => <MenuPrimitive.Label className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)} {...props} />;
export const DropdownMenuSeparator = ({ className, ...props }) => <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
