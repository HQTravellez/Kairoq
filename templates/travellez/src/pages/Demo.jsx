import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { functions } from 'kairoq';
import { toast } from 'sonner';
import { Check, ArrowDown, BadgeDollarSign, MessagesSquare, Sparkles } from 'lucide-react';
import { EarlyAccess, ClosingTrio } from '../components/Closing.jsx';

export const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const EMPTY = { first_name: '', last_name: '', email: '', company: '', company_size: '', phone: '', website: '' };

function Field({ id, label, optional, children }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}{optional ? <span className="font-normal text-[#8a8e96]"> (optional)</span> : <span className="text-[#ef3444]"> *</span>}</label>{children}</div>;
}

export default function Demo() {
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const [f, setF] = useState(EMPTY), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { await functions.invoke('lead', { kind: 'demo', ...f, message: plan ? 'Interested in the ' + plan + ' plan' : '' }); setDone(true); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  return (
    <>
      <section className="mx-auto max-w-[1280px] px-5 pb-12 pt-16 lg:px-8 lg:pt-24">
        <p className="tag">Book a demo</p>
        <h1 className="mt-6 max-w-4xl text-balance font-display text-[42px] font-bold leading-[1] sm:text-[64px]">See Travellez on your own travel programme.</h1>
        <p className="mt-6 max-w-2xl text-lg text-[#5f646d]">30 minutes, your numbers, no commitment. We'll show booking, approvals, and reporting working end to end, and where your spend is leaking today.</p>
        <a href="#demo-form" onClick={(e) => { e.preventDefault(); document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' }); }} className="btn-ghost mt-8">Jump to the form <ArrowDown size={15} /></a>
      </section>
      <section className="mx-auto grid max-w-[1280px] gap-10 px-5 pb-24 lg:grid-cols-[1fr_1.1fr] lg:px-8">
        <div className="lg:pt-6">
          <p className="eyebrow">Get started</p>
          <h2 className="mt-2 font-display text-3xl font-bold">See Travellez on your own trips</h2>
          <p className="mt-3 text-[#5f646d]">Book a personalized demo and discover how Travellez can save your company time and money while keeping employees happy.</p>
          <ul className="mt-6 space-y-3">{['See a personalized demo in under 30 minutes', 'Learn how to save up to 25% on travel', 'Get answers to your specific questions', 'No commitment required'].map((x) => <li key={x} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#fdf0f1] text-[#ef3444]"><Check size={14} /></span>{x}</li>)}</ul>
          <div className="mt-10 space-y-5 border-t border-[#edebe8] pt-8">
            {[[BadgeDollarSign, 'Founding member pricing', 'Lock in our launch rate for two full years. The price goes up once we open to everyone. Early companies keep the old one.'], [MessagesSquare, 'Direct line to the product team', 'Early members talk straight to the people building Travellez. Your feedback shapes the roadmap, and your requests get built first.'], [Sparkles, 'White glove onboarding', 'We set up your travel policy, connect your expense tools, and import your team for you. Most companies are live within a week.']].map(([Icon, t, d]) => (
              <div key={t} className="flex gap-4"><Icon size={20} className="mt-1 shrink-0 text-[#ef3444]" /><div><p className="font-semibold">{t}</p><p className="text-sm text-[#5f646d]">{d}</p></div></div>
            ))}
          </div>
        </div>
        <div id="demo-form" className="card scroll-mt-28 p-6 sm:p-8">
          {done ? (
            <div className="py-10 text-center" role="status">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e8f6ee] text-[#17804a]"><Check size={24} /></span>
              <h2 className="mt-4 font-display text-2xl font-bold">Thanks, {f.first_name}. We received your request.</h2>
              <p className="mt-2 text-[#5f646d]">We'll be in touch within 24 hours at {f.email}.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div><h2 className="font-display text-2xl font-bold">Book Your Demo</h2><p className="mt-1 text-sm text-[#5f646d]">Fill out the form and we'll be in touch within 24 hours.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="d-first" label="First Name"><input id="d-first" required value={f.first_name} onChange={set('first_name')} className="input" autoComplete="given-name" /></Field>
                <Field id="d-last" label="Last Name"><input id="d-last" required value={f.last_name} onChange={set('last_name')} className="input" autoComplete="family-name" /></Field>
              </div>
              <Field id="d-email" label="Work Email"><input id="d-email" type="email" required value={f.email} onChange={set('email')} className="input" autoComplete="email" /></Field>
              <Field id="d-company" label="Company Name"><input id="d-company" required value={f.company} onChange={set('company')} className="input" autoComplete="organization" /></Field>
              <Field id="d-size" label="Number of Employees">
                <select id="d-size" required value={f.company_size} onChange={set('company_size')} className="input">
                  <option value="">Select company size</option>{SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </Field>
              <Field id="d-phone" label="Phone Number" optional><input id="d-phone" type="tel" value={f.phone} onChange={set('phone')} className="input" autoComplete="tel" /></Field>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />
              <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'Sending…' : 'Request Demo'}</button>
              <p className="text-center text-xs text-[#8a8e96]">By submitting, you agree to our Terms of Service and Privacy Policy.</p>
            </form>
          )}
        </div>
      </section>
      <EarlyAccess />
      <ClosingTrio />
    </>
  );
}
