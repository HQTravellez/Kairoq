import React from 'react';
import { Toaster as Sonner, toast } from 'sonner';

// Render <Toaster /> once in App, then call toast.success('Saved') anywhere.
export function Toaster(props) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{ classNames: { toast: 'border border-border bg-card text-card-foreground shadow-glow', description: 'text-muted-foreground' } }}
      {...props}
    />
  );
}
export { toast };
