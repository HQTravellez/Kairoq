import { Link } from 'react-router-dom';
import { Check, X, ArrowRight, Radio, Award, Mail, Leaf, RefreshCw, Gift } from 'lucide-react';

const STAGES = ['Booking', 'Approvals', 'Expense Management', 'Trip Planning', 'Business Outcomes'];
export function Comparison() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-24 lg:px-8">
      <p className="eyebrow">Why we're different</p>
      <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Most tools stop at booking.</h2>
      <p className="mt-3 text-lg text-[#5f646d]">Travellez connects the entire trip, from booking to business outcomes.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="panel p-7"><p className="eyebrow">Typical tools</p><p className="mt-1 font-display text-xl font-bold">Booking-first &amp; fragmented</p>
          <ul className="mt-5 space-y-3">{STAGES.map((s, i) => <li key={s} className={'flex items-center gap-3 text-[15px] ' + (i ? 'text-[#9a9ea6]' : '')}>{i ? <X size={17} /> : <Check size={17} className="text-[#17804a]" />}{s}</li>)}</ul></div>
        <div className="rounded-3xl bg-[#14161a] p-7 text-white"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ff8a94]">Travellez</p><p className="mt-1 font-display text-xl font-bold">The complete travel OS</p>
          <ul className="mt-5 space-y-3">{STAGES.map((s) => <li key={s} className="flex items-center gap-3 text-[15px]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#ef3444]"><Check size={12} /></span>{s}</li>)}</ul></div>
      </div>
      <h3 className="mt-16 font-display text-2xl font-bold">More under the hood</h3>
      <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {[[Radio, 'Real-time inventory', 'GDS and direct partners, searched together.'], [Award, 'Loyalty auto-attached', 'Every booking keeps earning points automatically.'], [Mail, 'Approvals in email', 'Decide in 30 seconds, no login required.'], [Leaf, 'CO₂ per trip', 'Tracked automatically for your ESG report.'], [RefreshCw, 'ERP & finance sync', 'QuickBooks, NetSuite, or plain CSV via Zapier.'], [Gift, 'Referral rewards', 'Send us a peer, you both get rewarded.']].map(([Icon, t, d]) => (
          <div key={t} className="flex gap-3 border-t border-[#edebe8] pt-4"><Icon size={18} className="mt-0.5 shrink-0 text-[#ef3444]" /><div><dt className="font-semibold">{t}</dt><dd className="mt-0.5 text-sm text-[#5f646d]">{d}</dd></div></div>
        ))}
      </dl>
    </section>
  );
}
export function EarlyAccess() {
  return (
    <section className="px-5 pb-20 lg:px-8">
      <div className="mx-auto max-w-[1280px] overflow-hidden rounded-[32px] bg-[#ef3444] px-7 py-14 text-white sm:px-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Early access program</p>
        <h2 className="mt-3 max-w-2xl text-balance font-display text-4xl font-bold sm:text-5xl">We're onboarding a small group of founding companies</h2>
        <p className="mt-4 max-w-2xl text-lg text-white/85">Travellez is opening its doors to a limited number of businesses first. Join now and you get preferred pricing, priority onboarding, and a say in what we build next.</p>
        <p className="mt-3 text-sm text-white/75">No long contracts. No setup fees. If it's not a fit, you walk away and keep your data.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/demo" className="btn bg-white text-[#14161a] hover:bg-[#fbfaf9]">Apply for early access <ArrowRight size={15} /></Link><Link to="/savings-calculator" className="btn border border-white/40 text-white hover:bg-white/10">See what you'd save</Link></div>
      </div>
    </section>
  );
}
export function ClosingTrio() {
  return (
    <section className="border-t border-[#edebe8] bg-[#f7f6f3] py-16">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        <h2 className="font-display text-3xl font-bold">Ready to get to work?</h2>
        <p className="mt-2 max-w-2xl text-[#5f646d]">We're on a mission to erase shadow work from every corner of business so you can take back time to focus on what matters: real work with real impact.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[['Founding companies', 'A small group of Canadian teams get early access pricing, hands-on setup and direct founder support.', 'Book a demo', '/demo'], ['Pricing that starts free', 'Starter has no monthly fee. You pay a booking fee per trip, and move up a plan only when it earns its keep.', 'See plans', '/pricing'], ["See what you'd save", 'Model the spend leaking out of your programme in under two minutes.', 'Savings calculator', '/savings-calculator']].map(([t, d, cta, to]) => (
            <div key={t} className="card flex flex-col p-6"><h3 className="font-display text-lg font-bold">{t}</h3><p className="mt-2 flex-1 text-sm text-[#5f646d]">{d}</p><Link to={to} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#ef3444] hover:underline">{cta} <ArrowRight size={14} /></Link></div>
          ))}
        </div>
      </div>
    </section>
  );
}
