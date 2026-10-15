import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { ClosingTrio } from '../components/Closing.jsx';

export const PLANS = [
  { id: 'starter', name: 'Starter', blurb: 'For small teams starting to bring business travel into one place.', monthly: 0, fee: '4%*', policies: '1 policy', items: ['Core platform access', 'Standard flight and hotel booking', 'Unused ticket tracking'] },
  { id: 'growth', name: 'Growth', blurb: 'For growing teams that need stronger controls, visibility and support.', monthly: 89, fee: '3.5%*', policies: 'Up to 5 policies', items: ['Duty of Care and live map', 'SAML SSO and directory sync', 'Team and department reporting'] },
  { id: 'business', name: 'Business', blurb: 'For larger travel programs with advanced policy and reporting needs.', monthly: 219, fee: '3.5%*', policies: 'Unlimited policies', items: ['Strategic Trip Planner access', 'Unused ticket auto-recovery', 'Advanced reporting and ROI tracking'] }
];
// Annual billing saves 17%, shown as the monthly equivalent.
export const price = (p, annual) => (annual ? Math.round(p.monthly * 0.83) : p.monthly);
export const planFor = (travelers) => (travelers <= 10 ? 'starter' : travelers <= 100 ? 'growth' : 'business');
const ROWS = [
  ['Inventory access', 'Flights, hotels, cars', 'Full + corporate housing', 'Full + Strategic Trip Planner'],
  ['Booking fee', '4%*', '3.5%*', '3.5%*'],
  ['Unused ticket tracking', 'Included', 'Included + auto-recovery', 'Included + auto-recovery'],
  ['Smart Trip Briefs', '5 / month', '25 / user / month', '100 / company / month'],
  ['Custom policy engine', '1 policy', '5 policies', 'Unlimited policies'],
  ['Duty of Care tracker', '—', 'Included', 'Priority alerts'],
  ['SAML SSO and SCIM sync', '—', 'Included', 'Custom enterprise IdP'],
  ['Reporting and analytics', 'Account summary', 'Team and department spend', 'Advanced + ROI tracking']
];
const FOOTNOTE = '* Booking fees apply per ticket. A minimum and maximum service fee also applies to each booking, and we confirm the exact figures with you during setup.';

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [team, setTeam] = useState(35);
  const fit = planFor(team);
  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pb-12 pt-16 text-center lg:px-8 lg:pt-24">
        <p className="eyebrow text-[#ef3444]">Corporate travel pricing</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-balance font-display text-[42px] font-bold leading-[1] sm:text-6xl">Simple pricing that scales with your team</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[#5f646d]">Start with the essentials, then add stronger controls as your travel program grows. No setup fees.</p>
        <div className="mt-8 inline-flex items-center rounded-full border border-[#e3e1dd] bg-white p-1" role="group" aria-label="Billing period">
          {[['Monthly', false], ['Annual', true]].map(([label, v]) => (
            <button key={label} type="button" aria-pressed={annual === v} onClick={() => setAnnual(v)} className={'relative rounded-full px-5 py-2 text-sm font-semibold ' + (annual === v ? 'text-white' : 'text-[#5f646d]')}>
              {annual === v && <motion.span layoutId="bill" className="absolute inset-0 rounded-full bg-[#14161a]" />}
              <span className="relative">{label}{v && <span className={'ml-2 rounded-full px-1.5 py-0.5 text-[11px] ' + (annual ? 'bg-[#ef3444] text-white' : 'bg-[#fdf0f1] text-[#d0202f]')}>Save 17%</span>}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <div className="panel grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_1.4fr] md:items-center">
          <div>
            <p className="eyebrow">Find your fit</p>
            <label htmlFor="team-size" className="mt-2 block font-display text-2xl font-bold">How many team members travel?</label>
            <p className="mt-1 text-sm text-[#5f646d]">Move the slider to see the plan suited to your current team.</p>
          </div>
          <div>
            <p className="font-display text-4xl font-bold tabular">{team >= 250 ? '250+' : team}<span className="ml-1 font-sans text-base font-medium text-[#5f646d]">travelers</span></p>
            <input id="team-size" type="range" min="5" max="250" value={team} onChange={(e) => setTeam(Number(e.target.value))} className="mt-3 w-full" />
            <div className="mt-1 flex justify-between text-xs text-[#8a8e96]"><span>5</span><span>50</span><span>100</span><span>250+</span></div>
            <p className="mt-3 text-sm"><span className="eyebrow mr-2">Recommended for your team size</span><b>{PLANS.find((p) => p.id === fit).name} plan</b></p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => {
            const hot = p.id === fit, amount = price(p, annual);
            return (
              <div key={p.id} data-plan={p.id} className={'relative flex flex-col rounded-3xl p-7 transition ' + (hot ? 'bg-[#14161a] text-white shadow-[0_30px_60px_-30px_rgb(20_22_26/.6)]' : 'border border-[#edebe8] bg-white')}>
                {hot && <span className="absolute -top-3 left-7 rounded-full bg-[#ef3444] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Recommended</span>}
                <h2 className="font-display text-2xl font-bold">{p.name}</h2>
                <p className={'mt-2 min-h-[48px] text-sm ' + (hot ? 'text-white/65' : 'text-[#5f646d]')}>{p.blurb}</p>
                <p className="mt-6 font-display text-5xl font-bold tabular">{amount ? '$' + amount : 'Free'}{amount ? <span className={'ml-1 font-sans text-base font-medium ' + (hot ? 'text-white/60' : 'text-[#5f646d]')}>/ month</span> : null}</p>
                <p className={'mt-1 h-4 text-xs ' + (hot ? 'text-white/50' : 'text-[#8a8e96]')}>{annual && amount ? 'Billed annually, $' + amount * 12 + ' a year' : ''}</p>
                <dl className={'mt-6 space-y-2 border-y py-5 text-sm ' + (hot ? 'border-white/10' : 'border-[#edebe8]')}>
                  <div className="flex justify-between"><dt className={hot ? 'text-white/60' : 'text-[#5f646d]'}>Booking fee</dt><dd className="font-semibold">{p.fee}</dd></div>
                  <div className="flex justify-between"><dt className={hot ? 'text-white/60' : 'text-[#5f646d]'}>Travel policies</dt><dd className="font-semibold">{p.policies}</dd></div>
                </dl>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">{p.items.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#ef3444]" />{x}</li>)}</ul>
                <Link to={'/demo?plan=' + p.id} className={'mt-7 ' + (hot ? 'btn-primary' : 'btn-ghost')}>Talk to sales</Link>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-[#8a8e96]">{FOOTNOTE}</p>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8">
        <p className="eyebrow">Compare plans</p>
        <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Choose the level of control you need</h2>
        <div className="mt-8 overflow-x-auto rounded-3xl border border-[#edebe8] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-[#edebe8]"><th scope="col" className="px-6 py-4 font-semibold text-[#5f646d]">Features</th>{PLANS.map((p) => <th key={p.id} scope="col" className={'px-6 py-4 font-display text-base font-bold ' + (p.id === fit ? 'text-[#ef3444]' : '')}>{p.name}</th>)}</tr></thead>
            <tbody>{ROWS.map(([f, ...v]) => <tr key={f} className="border-b border-[#f1efec] last:border-0"><th scope="row" className="px-6 py-4 font-medium">{f}</th>{v.map((x, i) => <td key={i} className={'px-6 py-4 ' + (x === '—' ? 'text-[#b5b8bd]' : 'text-[#3c4048]')}>{x}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[#8a8e96]">{FOOTNOTE}</p>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-[#edebe8] bg-[#f7f6f3] p-7">
          <div><h3 className="font-display text-2xl font-bold">Not sure which plan fits?</h3><p className="mt-1 text-[#5f646d]">Tell us how your team travels. We will walk through the right setup and pricing with you.</p></div>
          <Link to="/demo" className="btn-primary">Book a demo <ArrowRight size={15} /></Link>
        </div>
      </section>
      <ClosingTrio />
    </>
  );
}
