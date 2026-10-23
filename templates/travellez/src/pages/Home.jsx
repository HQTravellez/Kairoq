import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, MessageSquareText, Route, Landmark } from 'lucide-react';
import Devices from '../components/Devices.jsx';
import TabsVsTrip from '../components/TabsVsTrip.jsx';
import LiveStream from '../components/LiveStream.jsx';
import TripBrief from '../components/TripBrief.jsx';
import Copilot from '../components/Copilot.jsx';
import SavingsCalculator from '../components/SavingsCalculator.jsx';
import Reveal from '../components/Reveal.jsx';
import { Comparison, EarlyAccess } from '../components/Closing.jsx';

function Hero() {
  const [email, setEmail] = useState('');
  const go = useNavigate();
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:pt-20">
        <div>
          <p className="tag">All-in-one booking, policy and expenses</p>
          <h1 className="mt-6 text-balance font-display text-[44px] font-bold leading-[0.98] sm:text-[64px]">
            Corporate travel that{' '}
            <span className="relative inline-block">gives you time back<span className="text-[#ef3444]">.</span>
              <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M2 9C70 3 170 2 298 6" fill="none" stroke="#ef3444" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} /></svg>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-[#5f646d]">Travellez puts flights, hotels, ground and expenses in one place. Your travelers book faster, finance stays in control, and every trip comes back coded to the right cost centre.</p>
          <form className="mt-8 flex max-w-md gap-2 rounded-full border border-[#e3e1dd] bg-white p-1.5 shadow-sm" onSubmit={(e) => { e.preventDefault(); go('/app?email=' + encodeURIComponent(email)); }}>
            <label htmlFor="hero-email" className="sr-only">Work email</label>
            <input id="hero-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="min-w-0 flex-1 bg-transparent px-4 text-[15px] outline-none" />
            <button className="btn-primary">Get started</button>
          </form>
          <p className="mt-4 text-sm text-[#5f646d]">Prefer a walkthrough? <Link to="/demo" className="font-semibold text-[#14161a] underline underline-offset-4 hover:text-[#ef3444]">Book a demo</Link> or <Link to="/savings-calculator" className="font-semibold text-[#14161a] underline underline-offset-4 hover:text-[#ef3444]">run the numbers</Link>.</p>
          <div className="mt-10 max-w-md border-l-2 border-[#ef3444] pl-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ef3444]">Founding cohort open</p>
            <p className="mt-1 text-sm leading-relaxed text-[#3c4048]">We're onboarding a small group of founding Canadian companies at early-access pricing, with setup handled by our team.</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}><Devices /></motion.div>
      </div>
    </section>
  );
}

const STEPS = [
  [MessageSquareText, 'You say it plainly', '"Toronto to Calgary, two client meetings, back Thursday."', "No forms, no tab hopping. Write the trip the way you'd say it out loud."],
  [Route, 'Travellez builds the trip', 'Flights, hotel and ground, sequenced around the meetings', 'Policy applied as it plans, so what you see is already approvable.'],
  [Landmark, 'Finance sees the point', "Cost of the trip against the revenue it's chasing", 'Every trip lands with a client and a reason attached, not just a receipt.']
];
function SmartIntro() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
        <div><p className="eyebrow text-[#ef3444]">Smart Itinerary</p><h2 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.02] sm:text-5xl">From a sentence to a trip your CFO can justify.</h2></div>
        <p className="max-w-lg text-lg text-[#5f646d] lg:justify-self-end">Describe the trip, get the whole thing planned in policy, and see what it's worth against the client you're going to see.</p>
      </div>
      <ol className="mt-14 grid border-t border-[#14161a] md:grid-cols-3">
        {STEPS.map(([Icon, k, t, d], i) => (
          <Reveal key={k} delay={i * 0.08} className={'py-8 md:px-8 ' + (i ? 'border-t border-[#edebe8] md:border-l md:border-t-0' : 'md:pl-0')}>
            <li className="list-none">
              <div className="flex items-center justify-between"><span className="font-display text-sm font-bold text-[#9a9ea6]">0{i + 1}</span><Icon size={20} className="text-[#ef3444]" /></div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5f646d]">{k}</p>
              <p className="mt-2 font-display text-xl font-bold leading-snug">{t}</p>
              <p className="mt-3 text-[15px] text-[#5f646d]">{d}</p>
            </li>
          </Reveal>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6 rounded-3xl bg-[#14161a] px-7 py-7 text-white">
        <dl className="flex flex-wrap gap-x-14 gap-y-5">
          {[['6 min', 'to a full trip plan'], ['1 invoice', 'at the end of the month'], ['Per client', 'cost and return, tracked']].map(([a, b]) => <div key={a}><dt className="font-display text-3xl font-bold">{a}</dt><dd className="text-sm text-white/60">{b}</dd></div>)}
        </dl>
        <Link to="/product/smart-itinerary" className="btn-primary">See how it works <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}

const ROLES = [
  ['Finance & CFOs', "Every booking is coded to a cost center automatically, and out-of-policy spend is flagged before it's approved, not after it hits the P&L.", '/solutions/finance'],
  ['Travel Managers & Ops', "Set policy and negotiated rates once. Every search shows what's in-policy and what isn't, so nobody has to chase it down after the fact.", '/solutions/travel-managers'],
  ['Travelers & Assistants', 'Search flights, hotels, and ground in one place, with the itinerary and approvals built around the actual trip, not a stack of separate tabs.', '/solutions/travelers']
];
function Stakeholders() {
  return (
    <section className="bg-[#14161a] py-24 text-white">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ff8a94]">Built for every stakeholder</p>
        <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Different job, same login.</h2>
        <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
          {ROLES.map(([t, d, to]) => (
            <Link key={t} to={to} className="group grid gap-3 py-8 transition md:grid-cols-[1fr_1.6fr_auto] md:items-center md:gap-10">
              <h3 className="font-display text-2xl font-bold transition group-hover:text-[#ff5a68]">{t}</h3>
              <p className="text-white/65">{d}</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/80 group-hover:text-white">See how <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const TABS = {
  Booking: ['Book', 'Everything in one search, with policy applied.', "No more flipping between six tabs. Search flights, hotels, and ground, with your company's negotiated rates and travel policy already baked in. Every option is tagged in-policy or out-of-policy, so travelers know before they book.", ['Real-time inventory from GDS + direct partners', 'Loyalty programs auto-attached to every booking', 'In-policy / out-of-policy tagged on every result']],
  'Trip planner': ['Plan', 'The meetings come first. The bookings follow.', 'Add the clients and the reason for the trip, and Travellez sequences flights, the hotel and ground transfers around them, with the route mapped and the brief ready to share.', ['Itinerary built around meetings, not flights', 'Smarter alternatives priced side by side', 'One brief for the traveler, approver and finance']],
  'Spend & reporting': ['Report', 'Spend you can see before the month closes.', 'Every booking lands coded to a cost centre, with receipts attached and CO₂ counted. Finance gets one invoice and an export that matches the ERP.', ['Live spend by team, client and cost centre', 'One consolidated invoice each month', 'ERP export for QuickBooks, NetSuite or CSV']]
};
function Everything() {
  const [tab, setTab] = useState('Booking');
  const [k, t, d, items] = TABS[tab];
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8">
      <p className="eyebrow">Why Travellez</p>
      <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Everything business travel needs.</h2>
      <p className="mt-3 max-w-xl text-lg text-[#5f646d]">One platform for booking, managing, and planning, built for how teams actually travel.</p>
      <div className="mt-10 inline-flex rounded-full border border-[#e3e1dd] bg-white p-1" role="tablist" aria-label="Product areas">
        {Object.keys(TABS).map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={'relative rounded-full px-4 py-2 text-sm font-semibold transition ' + (tab === name ? 'text-white' : 'text-[#5f646d] hover:text-[#14161a]')}>
            {tab === name && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-[#14161a]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span className="relative">{name}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-8 grid gap-10 rounded-3xl border border-[#edebe8] bg-white p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr]" role="tabpanel">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ef3444]">{k}</p>
            <h3 className="mt-2 text-balance font-display text-3xl font-bold">{t}</h3>
            <p className="mt-4 text-[#5f646d]">{d}</p>
          </div>
          <ul className="space-y-3 self-center">
            {items.map((x) => <li key={x} className="flex items-start gap-3 rounded-2xl bg-[#f7f6f3] px-4 py-3.5 text-[15px] font-medium"><Check size={18} className="mt-0.5 shrink-0 text-[#ef3444]" />{x}</li>)}
          </ul>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Savings() {
  return (
    <section className="border-y border-[#edebe8] bg-white py-24">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <p className="tag">Free · No sign-up wall</p>
        <h2 className="mt-4 max-w-3xl text-balance font-display text-4xl font-bold sm:text-5xl">Find out what your travel programme is actually costing you.</h2>
        <p className="mt-3 max-w-2xl text-lg text-[#5f646d]">Four inputs, run against our 2026 spend benchmark. You get the number on screen straight away, every assumption shown, nothing to fill in first.</p>
        <div className="mt-12"><SavingsCalculator /></div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <SmartIntro />
      <TabsVsTrip />
      <LiveStream />
      <TripBrief />
      <Stakeholders />
      <Everything />
      <Copilot />
      <Savings />
      <Comparison />
      <EarlyAccess />
    </>
  );
}
