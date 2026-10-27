// Effects showcase: a landing page made with the open-source effect pieces in the kit.
import React from 'react';
import { Button } from './components/ui/button.jsx';
import { BackgroundPaths } from './components/ui/background-paths.jsx';
import { TextEffect } from './components/ui/text-effect.jsx';
import { TextLoop } from './components/ui/text-loop.jsx';
import { TextShimmer } from './components/ui/text-shimmer.jsx';
import { Magnetic } from './components/ui/magnetic.jsx';
import { AnimatedGroup } from './components/ui/animated-group.jsx';
import { Tilt } from './components/ui/tilt.jsx';
import { Spotlight } from './components/ui/spotlight.jsx';
import { ImageComparison, ImageComparisonImage, ImageComparisonSlider } from './components/ui/image-comparison.jsx';
import { ProgressiveBlur } from './components/ui/progressive-blur.jsx';
import { ScrollProgress } from './components/ui/scroll-progress.jsx';
import { InView } from './components/ui/in-view.jsx';
import { AnimatedGradient } from './components/ui/animated-gradient.jsx';

// Two photos of "the same room", drawn as SVG so the test needs no network.
const room = (wall, floor) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="320" fill="${wall}"/><rect y="320" width="800" height="180" fill="${floor}"/><rect x="520" y="120" width="160" height="200" fill="#ffffff" opacity=".7"/></svg>`);
const BEFORE = room('#9aa0a6', '#6b5b4b'), AFTER = room('#efe7da', '#b58b5e');

const FEATURES = [
  { title: 'Plans in a week', text: 'Drawings and a fixed quote before any wall comes down.' },
  { title: 'One crew', text: 'The same people from demolition to the last coat of paint.' },
  { title: 'Clean every night', text: 'Dust sheets down, tools away, rooms usable at night.' },
];

export default function App() {
  return (
    <main className="bg-background text-foreground">
      <ScrollProgress className="fixed inset-x-0 top-0 z-50 h-0.5 bg-primary" />
      <BackgroundPaths className="min-h-[640px]">
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <TextShimmer as="span" className="text-sm font-medium" data-testid="badge">Booking spring renovations</TextShimmer>
          <TextEffect as="h1" per="word" preset="fade-in-blur" className="mt-4 font-display text-5xl font-semibold tracking-tight sm:text-6xl">Rooms you will want to come home to</TextEffect>
          <p className="mt-5 text-lg text-muted-foreground">
            Renovations for <TextLoop className="font-medium text-primary" interval={1.5}><span>kitchens</span><span>bathrooms</span><span>basements</span></TextLoop> in Toronto.
          </p>
          <div className="mt-8 flex justify-center"><Magnetic intensity={0.3}><Button size="lg">Get a quote</Button></Magnetic></div>
        </div>
      </BackgroundPaths>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <AnimatedGroup preset="blur-slide" className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Tilt key={f.title} rotationFactor={6} className="rounded-2xl">
              <div className="relative h-full overflow-hidden rounded-2xl border bg-card p-8" data-testid="feature">
                <Spotlight size={220} />
                <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.text}</p>
              </div>
            </Tilt>
          ))}
        </AnimatedGroup>
      </section>
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="font-display text-4xl font-semibold">Before and after</h2>
        <div className="mt-8" data-testid="compare">
        <ImageComparison className="aspect-[16/10] w-full overflow-hidden rounded-2xl" enableHover>
          <ImageComparisonImage src={BEFORE} alt="Before" position="left" />
          <ImageComparisonImage src={AFTER} alt="After" position="right" />
          <ImageComparisonSlider className="w-0.5 bg-white" />
        </ImageComparison>
        </div>
        <InView once variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}>
          <div className="relative mt-12 overflow-hidden rounded-2xl">
            <img src={AFTER} alt="The finished kitchen" className="block w-full" />
            <ProgressiveBlur className="absolute inset-x-0 bottom-0 h-1/3" direction="bottom" blurIntensity={0.5} />
            <p className="absolute bottom-4 left-5 text-lg font-medium text-white" data-testid="caption">The Lee kitchen, finished in April</p>
          </div>
        </InView>
      </section>
      <section className="relative overflow-hidden py-24" data-testid="cta">
        <AnimatedGradient />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-4xl font-semibold">Start with a free visit</h2>
          <Button size="lg" className="mt-6">Book a visit</Button>
        </div>
      </section>
    </main>
  );
}
