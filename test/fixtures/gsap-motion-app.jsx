import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, Draggable, InertiaPlugin);

const SHAPES = {
  calm: 'M100 20 C144 20 180 56 180 100 C180 144 144 180 100 180 C56 180 20 144 20 100 C20 56 56 20 100 20Z',
  burst: 'M100 10 L118 70 L180 60 L132 102 L170 160 L104 130 L70 186 L74 120 L14 110 L74 84Z',
};

export default function App() {
  const root = useRef(null);
  const [mode, setMode] = useState('calm');
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const split = SplitText.create('#title', { type: 'chars,words' });
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('#ring', { drawSVG: 0, duration: 0.6 })
        .from(split.chars, { yPercent: 110, opacity: 0, stagger: 0.02, duration: 0.4 }, '-=0.3');
      gsap.timeline({ scrollTrigger: { trigger: '#pin', start: 'top top', end: '+=1600', pin: true, scrub: true } })
        .to('#track', { xPercent: -66.666, ease: 'none' }, 0);
      const obj = { v: 0 }, el = document.querySelector('#hours');
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to(obj, { v: 40, duration: 0.6, onUpdate: () => { el.textContent = Math.round(obj.v); } }) });
      gsap.from('#wave', { drawSVG: 0, ease: 'none', scrollTrigger: { trigger: '#wave-box', start: 'top 75%', end: 'bottom 35%', scrub: true } });
      gsap.to('#rider', { motionPath: { path: '#route', align: '#route', alignOrigin: [0.5, 0.5] }, ease: 'none', scrollTrigger: { trigger: '#route-box', start: 'top 70%', end: 'bottom 30%', scrub: true } });
      Draggable.create('#swatch', { type: 'x,y', bounds: '#zone', inertia: true });
    }, root);
    return () => mm.revert();
  }, []);
  useLayoutEffect(() => { gsap.to('#morph', { morphSVG: SHAPES[mode], duration: 0.3 }); }, [mode]);
  return (
    <main ref={root} className="bg-background text-foreground">
      <section className="flex min-h-dvh items-center gap-10 px-10">
        <h1 id="title" aria-label="Hear less. Feel more." className="font-display text-7xl">Hear less. Feel more.</h1>
        <svg viewBox="0 0 100 100" className="h-40 w-40"><circle id="ring" cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      </section>
      <section id="pin" className="relative h-dvh overflow-hidden" aria-label="Features">
        <div id="track" className="flex h-full" style={{ width: '300%' }}>
          {['Sound', 'Battery', 'Comfort'].map((n, i) => <div key={n} data-panel={i} className="flex h-full items-center px-10" style={{ width: '33.333%' }}><h2 className="text-5xl">{n}</h2></div>)}
        </div>
      </section>
      <section className="px-10 py-24"><p className="text-8xl"><span id="hours">40</span> hours</p></section>
      <section id="wave-box" className="px-10 py-24"><svg viewBox="0 0 400 100" className="w-full"><path id="wave" d="M0 50 C50 0 100 100 150 50 S250 0 300 50 S350 100 400 50" fill="none" stroke="currentColor" strokeWidth="3" /></svg></section>
      <section id="route-box" className="px-10 py-24"><svg viewBox="0 0 400 120" className="w-full"><path id="route" d="M10 100 C100 100 120 20 200 20 S300 100 390 30" fill="none" stroke="currentColor" strokeDasharray="4 6" /><circle id="rider" r="8" fill="currentColor" /></svg></section>
      <section className="flex items-center gap-6 px-10 py-24">
        <svg viewBox="0 0 200 200" className="h-40 w-40"><path id="morph" d={SHAPES.calm} fill="currentColor" /></svg>
        <button type="button" onClick={() => setMode('burst')} aria-pressed={mode === 'burst'}>Focus</button>
      </section>
      <section className="px-10 py-24"><div id="zone" className="relative h-64 border" style={{ touchAction: 'none' }}><div id="swatch" className="absolute left-4 top-4 h-20 w-20 rounded-full bg-primary" /></div></section>
      <div className="h-[80vh]" />
    </main>
  );
}
