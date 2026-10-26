// Scroll assembly showcase: a watch that comes apart as the page scrolls and assembles again.
import React from 'react';
import { ScrollAssembly } from 'kairoq/hero3d';

export default function App() {
  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-semibold tracking-tight">Made to be seen</h1>
        <p className="mt-4 text-lg text-muted-foreground">Scroll to look inside.</p>
      </section>
      {/* Wrapped the way a builder sometimes does it: pinning must still work. */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-border">
      <ScrollAssembly
        object="watch"
        labels={{ Crystal: 'Sapphire crystal', Dial: 'Hand-finished dial', Rotor: '22k gold rotor' }}
        shots={[
          { at: 0, view: 'front-close', apart: 0, caption: 'Made to be seen' },
          { at: 0.2, view: 'three-quarter', apart: 0.3 },
          { at: 0.38, view: 'left', apart: 1, caption: '117 parts', text: 'Every one finished by hand.' },
          { at: 0.54, view: 'behind', apart: 1, caption: 'Look behind the dial' },
          { at: 0.7, view: 'top', apart: 0.9 },
          { at: 0.88, view: 'front', apart: 0.05, caption: 'Back in one piece' },
          { at: 1, view: 'front', apart: 0 },
        ]}
      >
        <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-sm text-muted-foreground">117 parts, 11 layers</p>
      </ScrollAssembly>
      </div>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center" data-after>
        <h2 className="font-display text-4xl font-semibold">Back in one piece.</h2>
      </section>
    </main>
  );
}
