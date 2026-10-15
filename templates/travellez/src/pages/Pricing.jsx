import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { functions } from 'kairoq';
import { toast } from 'sonner';
import PageHero from '../components/PageHero.jsx';
import { Field } from '../components/AuthPanel.jsx';

const PLANS = [
  { name: 'Starter', price: 'Free', unit: 'up to 10 travelers', cta: 'Start free', to: '/app', features: ['Trips, approvals and spend', 'One travel policy', 'Smart Itinerary', 'Email sign-in and Google'] },
  { name: 'Team', price: '€8', unit: 'per active traveler / month', cta: 'Start free, upgrade later', to: '/app', featured: true, features: ['Everything in Starter', 'Unlimited travelers', 'Automatic approval for in-policy trips', 'Spend by category and month', 'Priority support'] },
  { name: 'Enterprise', price: 'Custom', unit: 'for 200+ travelers', cta: 'Talk to sales', to: null, features: ['Everything in Team', 'Multiple policies and entities', 'SSO and audit exports', 'Dedicated onboarding'] }
];

export default function Pricing() {
  const [form, setForm] = useState({ name: '', email: '', company: '', team_size: '', message: '' });
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { await functions.invoke('lead', form); setSent(true); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple pricing that grows with your team." text="Start free. Pay only for people who actually travel in a month." />
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-20 lg:grid-cols-3 lg:px-8">
        {PLANS.map((p) => (
          <div key={p.name} className={'flex flex-col rounded-3xl p-8 ' + (p.featured ? 'aurora text-white shadow-2xl shadow-indigo-900/30' : 'card')}>
            <p className={'text-sm font-semibold ' + (p.featured ? 'text-teal-300' : 'text-indigo-600')}>{p.name}</p>
            <p className="mt-4 font-display text-5xl font-semibold">{p.price}</p>
            <p className={'mt-1 text-sm ' + (p.featured ? 'text-white/70' : 'text-slate-500')}>{p.unit}</p>
            <ul className="mt-8 flex-1 space-y-3 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-3"><Check size={18} className={p.featured ? 'text-teal-300' : 'text-teal-600'} />{f}</li>)}
            </ul>
            {p.to ? <Link to={p.to} className={(p.featured ? 'btn-light' : 'btn-dark') + ' mt-8 w-full py-3'}>{p.cta}</Link>
              : <a href="#sales" onClick={(e) => { e.preventDefault(); document.getElementById('sales').scrollIntoView({ behavior: 'smooth' }); }} className="btn-ghost mt-8 w-full py-3">{p.cta}</a>}
          </div>
        ))}
      </section>
      <section id="sales" className="mx-auto max-w-3xl px-5 pb-24 lg:px-8">
        <div className="card p-8 sm:p-10">
          <h2 className="font-display text-3xl font-semibold text-slate-900">Talk to sales</h2>
          {sent ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">Thanks, {form.name.split(' ')[0]}. We received your request and will reply to {form.email} within one business day.</p>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field id="lead-name" label="Your name"><input id="lead-name" required value={form.name} onChange={set('name')} className="input" /></Field>
              <Field id="lead-email" label="Work email"><input id="lead-email" type="email" required value={form.email} onChange={set('email')} className="input" /></Field>
              <Field id="lead-company" label="Company"><input id="lead-company" required value={form.company} onChange={set('company')} className="input" /></Field>
              <Field id="lead-size" label="Team size">
                <select id="lead-size" required value={form.team_size} onChange={set('team_size')} className="input"><option value="">Choose…</option>{['1-10', '11-50', '51-200', '201-1000', '1000+'].map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <div className="sm:col-span-2"><Field id="lead-message" label="What do you need? (optional)"><textarea id="lead-message" rows={3} value={form.message} onChange={set('message')} className="input" /></Field></div>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website || ''} onChange={set('website')} />
              <button disabled={busy} className="btn-primary py-3 sm:col-span-2">{busy ? 'Sending…' : 'Send request'}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
