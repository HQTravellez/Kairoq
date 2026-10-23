import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '../components/Reveal.jsx';
import { Comparison, ClosingTrio } from '../components/Closing.jsx';

export const ROLES = {
  finance: {
    label: 'Finance & CFOs', title: 'Control before the spend, not after.',
    lead: 'Out-of-policy spend is flagged before approval, not discovered in the P&L six weeks later. Every booking arrives coded to a cost center.',
    stats: [['8%', 'Duplicate spend recovered'], ['0', 'Manual coding at month close'], ['1 day', 'From trip to ERP export']],
    helps: [['Cost centers at booking', 'Team, project, and client attached at the point of purchase.'], ['Policy enforced up front', 'Fare and hotel caps applied per city tier, not one flat number.'], ['Live spend visibility', 'Committed spend, not just settled, so forecasts hold.'], ['ERP-ready', 'QuickBooks, NetSuite, CSV, Zapier.']],
    cta: ['See spend & reporting', '/savings-calculator']
  },
  'travel-managers': {
    label: 'Travel managers', title: 'Set policy once. Enforce it everywhere.',
    lead: "Caps, fare classes and approval rules live in one policy engine, so every search already shows what's in policy and nobody chases exceptions after the fact.",
    stats: [['100%', 'Of searches checked against policy'], ['30s', 'To approve a trip from email'], ['Global', 'Inventory across GDS and direct partners']],
    helps: [['One policy engine', 'City-tier caps, fare classes and approvers in one place.'], ['Duty of care', 'Know where travelers are, and reach them when plans change.'], ['Supplier mix in your control', 'Negotiated rates surface first in every search.'], ['Exception reporting', 'Repeat offenders and out-of-policy trends, before quarter close.']],
    cta: ['See pricing', '/pricing']
  },
  travelers: {
    label: 'Travelers', title: 'One login for the whole trip.',
    lead: 'Flights, hotels and ground in one search, built around the meetings that matter, with loyalty points kept and receipts handled for you.',
    stats: [['1', 'Login for the whole trip'], ['Global', 'Flights, stays and ground'], ['24/7', 'Human support when plans change']],
    helps: [['Book everything together', 'Flights, stays and ground in one search, already in policy.'], ['Loyalty kept intact', 'Your airline and hotel programmes attach to every booking.'], ['Plan the actual trip', 'The itinerary is built around meetings, not departure times.'], ['Expenses handled', 'Receipts attach themselves and the report drafts itself.']],
    cta: ['See Smart Itinerary', '/product/smart-itinerary']
  }
};

export default function Solutions() {
  const { role } = useParams();
  const r = ROLES[role] || ROLES.finance;
  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pb-16 pt-16 lg:px-8 lg:pt-24">
        <nav className="flex flex-wrap gap-2" aria-label="Solutions">
          {Object.entries(ROLES).map(([id, x]) => <Link key={id} to={'/solutions/' + id} className={'rounded-full px-3.5 py-1.5 text-sm font-semibold ' + (x === r ? 'bg-[#14161a] text-white' : 'border border-[#e3e1dd] bg-white text-[#5f646d] hover:text-[#14161a]')}>{x.label}</Link>)}
        </nav>
        <h1 className="mt-8 max-w-4xl text-balance font-display text-[42px] font-bold leading-[1] sm:text-[64px]">{r.title}</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#5f646d]">{r.lead}</p>
        <Link to="/demo" className="btn-primary mt-8">Book a demo <ArrowRight size={15} /></Link>
        <dl className="mt-16 grid border-t border-[#14161a] sm:grid-cols-3">
          {r.stats.map(([a, b], i) => <div key={b} className={'py-6 sm:px-6 ' + (i ? 'border-t border-[#edebe8] sm:border-l sm:border-t-0' : 'sm:pl-0')}><dt className="font-display text-5xl font-bold text-[#ef3444]">{a}</dt><dd className="mt-2 text-sm text-[#5f646d]">{b}</dd></div>)}
        </dl>
      </section>
      <section className="border-y border-[#edebe8] bg-white py-20">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
          <h2 className="font-display text-3xl font-bold">How Travellez helps</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {r.helps.map(([t, d], i) => <Reveal key={t} delay={i * 0.05} className="rounded-2xl bg-[#f7f6f3] p-6"><h3 className="font-display text-lg font-bold">{t}</h3><p className="mt-1.5 text-[#5f646d]">{d}</p></Reveal>)}
          </div>
          <Link to={r.cta[1]} className="mt-8 inline-flex items-center gap-1 font-semibold text-[#ef3444] hover:underline">{r.cta[0]} <ArrowRight size={15} /></Link>
        </div>
      </section>
      <Comparison />
      <ClosingTrio />
    </>
  );
}
