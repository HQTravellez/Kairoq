// Showcase of the kairoq/hero3d recipes, one per section, with real copy beside each scene.
import React from 'react';
import { DeviceMockup, Diorama, ExplodedView, GlassShapes, HeroObject } from 'kairoq/hero3d';

const SCREEN = typeof window !== 'undefined' ? window.__SCREEN__ : undefined;

function Row({ title, text, children, flip }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2" data-recipe={title}>
      <div className={flip ? 'md:order-2' : ''}>
        <h2 className="font-display text-4xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-4 max-w-md text-lg text-muted-foreground">{text}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function App() {
  return (
    <main className="bg-background text-foreground">
      <Row title="Travel, packed" text="Corporate trips booked inside your policy.">
        <HeroObject object="suitcase" height={460} />
      </Row>
      <Row title="Glass and light" text="An AI assistant for your finance team." flip>
        <GlassShapes height={460} />
      </Row>
      <Row title="Your app, on every phone" text="Book, approve and pay from one screen.">
        <DeviceMockup device="phone" screenshot={SCREEN} height={480} />
      </Row>
      <Row title="Unwrap it" text="Scroll to open the box." flip>
        <ExplodedView object="gift-box" height={480} />
      </Row>
      <Row title="Stays across the city" text="Furnished homes for business travellers.">
        <Diorama objects={['house', 'tree', 'house', 'tree']} height={460} />
      </Row>
    </main>
  );
}
