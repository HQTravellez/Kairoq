import { Link } from 'react-router-dom';
import { ArrowRight, Plane, CheckCircle2, Wallet, Users, ShieldCheck, Sparkles, FileCheck2, Building2 } from 'lucide-react';
import RouteMap from '../components/RouteMap.jsx';
import ProductMockup from '../components/ProductMockup.jsx';
import Reveal from '../components/Reveal.jsx';

const PILLARS = [
  { icon: Plane, title: 'Trips', text: 'Every request, approval and booking in one place, with the traveler, dates, purpose and budget attached.' },
  { icon: CheckCircle2, title: 'Approvals', text: 'Managers approve or reject in one click. Trips inside policy can be approved automatically.' },
  { icon: Wallet, title: 'Spend', text: 'Expenses belong to a trip, move from draft to submitted to paid, and show up in the numbers right away.' },
  { icon: ShieldCheck, title: 'Controls', text: 'Set trip caps, hotel limits and how far ahead to book. Anything outside policy is flagged before money is spent.' }
];
const STEPS = [
  { n: '01', title: 'Request', text: 'A traveler describes the trip: where, when, why and roughly what it costs.' },
  { n: '02', title: 'Approve', text: 'Policy checks run instantly. The manager sees what is in and out of policy and decides.' },
  { n: '03', title: 'Book & reconcile', text: 'Approved trips are booked, expenses are added against them, and finance marks them paid.' }
];

export default function Home() {
  return (
    <>
      <section className="aurora relative overflow-hidden text-white">
        <div className="grid-lines absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-32 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-40">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"><Sparkles size={14} className="text-amber-300" /> Corporate travel, approvals and spend</p>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">Business travel that <span className="text-gradient">runs itself.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">Travellez turns trip requests into approved, booked and reconciled travel. One workspace for travelers, managers and finance, with your policy built in.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app" className="btn-light px-6 py-3 text-base">Start free <ArrowRight size={18} /></Link>
              <Link to="/platform" className="btn border border-white/25 px-6 py-3 text-base text-white hover:bg-white/10">See the platform</Link>
            </div>
            <p className="mt-5 text-sm text-white/55">Free for up to 10 travelers. No credit card.</p>
          </div>
          <div className="relative">
            <RouteMap className="absolute -inset-x-10 -top-16 w-[120%] opacity-90" />
            <div className="relative mt-24 lg:mt-36"><ProductMockup /></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">One platform</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900 sm:text-5xl">Everything a business trip needs, from request to reconciliation.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="card group h-full p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-indigo-600 text-white shadow-md"><p.icon size={20} /></span>
                <h3 className="mt-5 font-display text-xl font-semibold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900">Three steps. No email chains.</h2>
            <ol className="mt-10 space-y-8">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-5">
                  <span className="font-display text-2xl font-semibold text-indigo-600">{s.n}</span>
                  <div><h3 className="font-display text-xl font-semibold text-slate-900">{s.title}</h3><p className="mt-1 text-slate-600">{s.text}</p></div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="aurora rounded-3xl p-6 sm:p-10"><ProductMockup compact /><div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur"><FileCheck2 size={18} className="mb-2 text-teal-300" />Every approval keeps who decided, when and why.</div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur"><Users size={18} className="mb-2 text-amber-300" />Travelers, managers and finance share one source of truth.</div>
            </div></div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">Smart Itinerary</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900">One sentence in. A structured trip out.</h2>
            <p className="mt-4 text-lg text-slate-600">Write "Lisbon offsite for 6 people, 12 to 14 March, under €900 each" and Travellez lays out the trip, the budget and what needs approval.</p>
            <Link to="/smart-itinerary" className="btn-dark mt-8">Try Smart Itinerary <ArrowRight size={16} /></Link>
          </div>
          <div className="card p-6">
            <p className="rounded-xl bg-slate-50 p-4 font-medium text-slate-800">“Lisbon offsite for 6 people, 12 to 14 March, under €900 each”</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              {[['Destination', 'Lisbon'], ['Travelers', '6'], ['Budget', '€5,400 total']].map(([k, v]) => <div key={k} className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 font-semibold text-slate-900">{v}</p></div>)}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-5 pb-24 lg:px-8">
        <Reveal className="aurora relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white sm:px-16">
          <div className="grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <Building2 className="mx-auto text-teal-300" size={28} />
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold sm:text-5xl">Give your team a calmer way to travel.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/75">Create a workspace in a minute, add your travelers and set your policy. Your first trip can be approved today.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/app" className="btn-light px-6 py-3 text-base">Start free</Link><Link to="/pricing" className="btn border border-white/25 px-6 py-3 text-base text-white hover:bg-white/10">See pricing</Link></div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
