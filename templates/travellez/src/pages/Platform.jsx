import { Link } from 'react-router-dom';
import { Plane, CheckCircle2, Wallet, Users, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import Reveal from '../components/Reveal.jsx';

const SURFACES = [
  { icon: Plane, name: 'Trips', title: 'A single record for every trip', points: ['Traveler, route, dates, purpose and estimate', 'Status from requested to approved to booked', 'Search and filter by status, traveler or city', 'Spend so far, next to the estimate'], demo: [['London → Lisbon', 'Booked', 'emerald'], ['Berlin → Amsterdam', 'Approved', 'indigo'], ['Paris → Toronto', 'Requested', 'amber']] },
  { icon: CheckCircle2, name: 'Approvals', title: 'Decisions with context, in one click', points: ['Pending requests first, with the policy result', 'Approve or reject with a note', 'Only requested trips can be approved, only approved trips can be booked', 'A full history of who decided what and when'], demo: [['Paris → Toronto · €2,350', 'Above trip cap', 'amber'], ['Madrid → Milan · €420', 'Within policy', 'emerald']] },
  { icon: Wallet, name: 'Spend', title: 'Expenses that belong to a trip', points: ['Flights, hotels, ground, meals and other', 'Draft, submitted and paid, in that order', 'Totals by category and by month', 'Finance sees what is waiting to be paid'], demo: [['Return flight LHR–LIS', '€286 · Paid', 'emerald'], ['Hotel, 2 nights', '€312 · Submitted', 'amber']] },
  { icon: Users, name: 'Travelers', title: 'Your people, by team', points: ['Name, work email and department', 'Active or inactive (inactive people cannot travel)', 'Trips per person at a glance'], demo: [['Amara Okafor · Sales', 'Active', 'emerald'], ['Jonas Berg · Finance', 'Active', 'emerald']] },
  { icon: ShieldCheck, name: 'Controls', title: 'Your travel policy, enforced', points: ['Trip cap and hotel night cap', 'Minimum days to book ahead', 'Automatic approval for small trips inside policy', 'Out-of-policy trips are flagged with the reason'], demo: [['Trip cap', '€1,500', 'indigo'], ['Book ahead', '7 days', 'indigo']] }
];
const TONE = { emerald: 'bg-emerald-50 text-emerald-700', indigo: 'bg-indigo-50 text-indigo-700', amber: 'bg-amber-50 text-amber-700' };

export default function Platform() {
  return (
    <>
      <PageHero eyebrow="Platform" title="Five surfaces. One source of truth." text="Travellez connects the people who travel, the people who approve and the people who pay. Here is what each of them sees." />
      <div className="mx-auto max-w-7xl space-y-24 px-5 py-24 lg:px-8">
        {SURFACES.map((s, i) => (
          <Reveal key={s.name} className={'grid items-center gap-12 lg:grid-cols-2 ' + (i % 2 ? 'lg:[&>*:first-child]:order-2' : '')}>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"><s.icon size={16} />{s.name}</span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">{s.title}</h2>
              <ul className="mt-6 space-y-3">
                {s.points.map((p) => <li key={p} className="flex gap-3 text-slate-700"><Check size={18} className="mt-0.5 shrink-0 text-teal-600" />{p}</li>)}
              </ul>
            </div>
            <div className="aurora rounded-3xl p-6 sm:p-8">
              <div className="rounded-2xl bg-white p-5 shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.name}</p>
                <ul className="mt-3 space-y-2">
                  {s.demo.map(([a, b, t]) => <li key={a} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 text-sm"><span className="font-medium text-slate-800">{a}</span><span className={'pill ' + TONE[t]}>{b}</span></li>)}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
        <div className="text-center"><Link to="/app" className="btn-primary px-6 py-3 text-base">Open your workspace <ArrowRight size={18} /></Link></div>
      </div>
    </>
  );
}
