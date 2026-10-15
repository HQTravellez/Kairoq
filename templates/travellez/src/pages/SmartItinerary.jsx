import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Hotel, Car, CalendarDays, Receipt, ArrowRight, ChevronDown, Check } from 'lucide-react';
import Reveal from '../components/Reveal.jsx';
import { ClosingTrio } from '../components/Closing.jsx';
import { money } from '../lib/format.js';

// One London trip, segment by segment. Each segment can swap to the smarter option, and
// the total at the bottom shows what applying the suggestions saves. Sample trip data.
export const SEGMENTS = [
  { id: 'flight', icon: Plane, kind: 'Flight', badge: 'In policy', price: 742, title: 'AC 852 · YYZ → LHR', meta: 'Tue 08:15 · 7h 25m · economy flex', alt: { save: 91, price: 651, title: 'AC 856 · YYZ → LHR', meta: 'Tue 21:40 · overnight · same fare class' } },
  { id: 'stay', icon: Hotel, kind: 'Stay', badge: 'Negotiated rate', price: 486, title: 'The Standard, Shoreditch', meta: '3 nights · 12 min from client office', alt: { save: 48, price: 438, title: 'Mondrian Shoreditch', meta: '3 nights · 9 min from client office' } },
  { id: 'ground', icon: Car, kind: 'Ground', badge: 'In policy', price: 58, title: 'Airport transfer', meta: 'Pre-booked · fixed fare · receipt attached', alt: { save: 26, price: 32, title: 'Heathrow Express + walk', meta: 'Same arrival window · 15 min faster' } },
  { id: 'meetings', icon: CalendarDays, kind: 'Meetings', badge: 'Auto-synced', price: null, title: 'Client visit · Monzo HQ', meta: 'Wed 14:00 · pulled from your calendar', alt: { save: 0, price: null, title: 'Two visits, one trip', meta: 'Monzo 14:00 + Starling 17:00 same day' } },
  { id: 'expense', icon: Receipt, kind: 'Expense', badge: 'ERP ready', price: null, title: 'Expense pack', meta: 'Coded to CC-2214 · pushed to NetSuite', alt: { save: 49, price: null, title: 'Zero-touch close', meta: 'Reconciled the day the trip ends' } }
];
export function applied(on) { return SEGMENTS.filter((s) => on[s.id]).reduce((n, s) => n + s.alt.save, 0); }

function Segment({ s, open, onToggle, use, onUse }) {
  const Icon = s.icon;
  return (
    <li className="relative pl-14">
      <span className="absolute left-0 top-5 grid h-10 w-10 place-items-center rounded-full border border-[#edebe8] bg-white text-[#ef3444]"><Icon size={18} /></span>
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f646d]">{s.kind}<span className="ok normal-case tracking-normal">{s.badge}</span></p>
            <p className={'mt-2 font-semibold ' + (use ? 'text-[#9a9ea6] line-through' : '')}>{s.title}</p>
            <p className="text-sm text-[#5f646d]">{s.meta}</p>
          </div>
          <p className="font-display text-xl font-bold tabular">{s.price == null ? (s.id === 'expense' ? 'Auto' : '—') : money(s.price, 'USD')}</p>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={open} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#ef3444]">Show the smarter option <ChevronDown size={15} className={'transition ' + (open ? 'rotate-180' : '')} /></button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#f6c9cd] bg-[#fdf6f6] p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ef3444]">Travellez suggests {s.alt.save ? <span className="ml-1 text-[#17804a]">−{money(s.alt.save, 'USD')}</span> : null}</p>
                  <p className="mt-1 font-semibold">{s.alt.title}</p>
                  <p className="text-sm text-[#5f646d]">{s.alt.meta}{s.alt.price != null ? ' · ' + money(s.alt.price, 'USD') : ''}</p>
                </div>
                <button type="button" onClick={onUse} className={use ? 'btn-dark' : 'btn-ghost'}>{use ? <><Check size={15} />Applied</> : 'Use this'}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

export default function SmartItinerary() {
  const [open, setOpen] = useState({ flight: true });
  const [on, setOn] = useState({});
  const saved = applied(on), all = SEGMENTS.every((s) => on[s.id]);
  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pb-16 pt-16 lg:px-8 lg:pt-24">
        <p className="tag">Smart Itinerary</p>
        <h1 className="mt-6 max-w-4xl text-balance font-display text-[42px] font-bold leading-[1] sm:text-[64px]">The whole trip, assembled before anyone books.</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#5f646d]">Travellez sequences flights, stays, ground, meetings, and expenses into one itinerary, checked against policy, priced against the alternatives, and ready for approval in a single view.</p>
        <Link to="/demo" className="btn-primary mt-8">Book a demo <ArrowRight size={15} /></Link>
      </section>
      <section className="border-y border-[#edebe8] bg-white">
        <div className="mx-auto max-w-[1280px] px-5 py-16 lg:px-8">
          <p className="eyebrow">What you get</p>
          <dl className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[['End-to-end sequencing', 'Every segment ordered around the meetings that justify the trip, not the other way round.'], ['Smarter alternatives, priced', 'Each segment comes with a cheaper or faster option and the exact delta.'], ['Policy resolved up front', 'Caps, fare classes, and city tiers evaluated before the request reaches an approver.'], ['Finance-ready on arrival', 'Coded to the cost center and pushed to your ERP the day the trip ends.']].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.06}><dt className="font-display text-lg font-bold"><span className="mr-2 text-[#ef3444]">0{i + 1}</span>{t}</dt><dd className="mt-2 text-[15px] text-[#5f646d]">{d}</dd></Reveal>
            ))}
          </dl>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow text-[#ef3444]">The core of the platform</p>
          <h2 className="mt-3 font-display text-4xl font-bold">Toronto → London, three nights.</h2>
          <p className="mt-4 text-[#5f646d]">One trip, assembled end to end. Travellez sequences every segment, checks it against policy, prices the alternatives, and keeps finance in the loop, before anyone books.</p>
          <div className="mt-8 rounded-3xl bg-[#14161a] p-6 text-white" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">{all ? 'Applying every suggestion on this trip' : 'Suggestions applied'}</p>
            <p className="mt-2 font-display text-4xl font-bold text-[#ff5a68] tabular">Saves {money(saved, 'USD')}</p>
            <p className="mt-1 text-sm text-white/60">{all ? 'and 3 hours of admin' : 'of $214 available on this trip'}</p>
            <button type="button" onClick={() => setOn(all ? {} : Object.fromEntries(SEGMENTS.map((s) => [s.id, true])))} className="btn-light mt-5">{all ? 'Reset the trip' : 'Apply every suggestion'}</button>
          </div>
        </div>
        <ol className="relative space-y-4 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-[#e3e1dd]">
          {SEGMENTS.map((s) => <Segment key={s.id} s={s} open={!!open[s.id]} onToggle={() => setOpen({ ...open, [s.id]: !open[s.id] })} use={!!on[s.id]} onUse={() => setOn({ ...on, [s.id]: !on[s.id] })} />)}
        </ol>
      </section>
      <ClosingTrio />
    </>
  );
}
