"use strict";
// Starter templates for Kairoq Create. Each is a complete, working project that
// customers can keep building on through chat.
const MAIN=`import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
`;
const CSS='@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';

const FORM_HOOK=`import { useState } from 'react';
import { collection, email } from 'kairoq';

// Saves a form to a submit-only collection and notifies the owner.
export function useSubmit(name, subject) {
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  async function submit(data) {
    setState({ sending: true, sent: false, error: '' });
    try {
      await collection(name).create(data);
      email.send({ to: 'owner', subject, text: Object.entries(data).map(([k, v]) => k + ': ' + v).join('\\n') }).catch(() => {});
      setState({ sending: false, sent: true, error: '' });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message });
    }
  }
  return [state, submit];
}
`;

const TEMPLATES=[
{id:'restaurant',name:'Restaurant',category:'Hospitality',description:'Menu, opening hours and a reservation form that emails you each booking.',
 files:{'src/backend.json':JSON.stringify({collections:{reservations:{access:'submit-only'}},email:true},null,2)+'\n','src/useSubmit.js':FORM_HOOK,
 'src/App.jsx':`import { useEffect } from 'react';
import { Clock, MapPin, UtensilsCrossed } from 'lucide-react';
import { useSubmit } from './useSubmit.js';

const MENU = [
  { section: 'Antipasti', items: [['Burrata, heirloom tomato, basil', 14], ['Fritto misto, lemon aioli', 16]] },
  { section: 'Pasta', items: [['Cacio e pepe, aged pecorino', 19], ['Tagliatelle, slow-cooked beef ragù', 23]] },
  { section: 'Dolci', items: [['Tiramisù della casa', 10], ['Olive oil cake, mascarpone', 9]] }
];

export default function App() {
  useEffect(() => { document.title = 'Trattoria Lume'; }, []);
  const [form, submit] = useSubmit('reservations', 'New reservation');
  function onSubmit(e) {
    e.preventDefault();
    submit(Object.fromEntries(new FormData(e.target)));
  }
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-[url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600')] bg-cover bg-center">
        <div className="bg-stone-900/60 px-6 py-24 text-center text-white">
          <UtensilsCrossed className="mx-auto mb-4" />
          <h1 className="text-5xl font-semibold tracking-tight">Trattoria Lume</h1>
          <p className="mt-4 text-lg text-stone-200">Seasonal Italian cooking, fresh pasta made every morning.</p>
          <a href="#book" className="mt-8 inline-block rounded-full bg-amber-500 px-6 py-3 font-semibold text-stone-900">Book a table</a>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="text-2xl font-semibold">Menu</h2>
          {MENU.map(group => (
            <div key={group.section} className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-700">{group.section}</h3>
              <ul className="mt-3 divide-y divide-stone-200">
                {group.items.map(([dish, price]) => (
                  <li key={dish} className="flex justify-between py-3"><span>{dish}</span><span className="font-medium">\${price}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Clock size={18} /> Opening hours</h2>
            <p className="mt-3 text-stone-600">Tue–Thu 5pm–10pm<br />Fri–Sat 5pm–11pm<br />Sun 12pm–9pm</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold"><MapPin size={18} /> Find us</h2>
            <p className="mt-3 text-stone-600">18 Harbour Street<br />Open kitchen, 40 seats</p>
          </div>
        </aside>
      </main>
      <section id="book" className="bg-stone-900 px-6 py-16 text-white">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-semibold">Reserve a table</h2>
          {form.sent ? (
            <p className="mt-6 rounded-xl bg-emerald-600 p-4">Thank you! We will confirm your table by email shortly.</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input required name="name" placeholder="Your name" className="rounded-lg px-4 py-3 text-stone-900" />
              <input required type="email" name="email" placeholder="Email" className="rounded-lg px-4 py-3 text-stone-900" />
              <input required type="date" name="date" className="rounded-lg px-4 py-3 text-stone-900" />
              <select name="guests" className="rounded-lg px-4 py-3 text-stone-900">{[1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n} guests</option>)}</select>
              <button disabled={form.sending} className="rounded-lg bg-amber-500 px-4 py-3 font-semibold text-stone-900 sm:col-span-2">{form.sending ? 'Sending…' : 'Request booking'}</button>
              {form.error && <p className="text-rose-300 sm:col-span-2">{form.error}</p>}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
`}},
{id:'guest-portal',name:'Hotel guest portal',category:'Hospitality',description:'Wi-Fi, check-out, house rules, local tips and a request form for guests.',
 files:{'src/backend.json':JSON.stringify({collections:{requests:{access:'submit-only'}},email:true},null,2)+'\n','src/useSubmit.js':FORM_HOOK,
 'src/App.jsx':`import { useEffect, useState } from 'react';
import { Wifi, LogOut, Coffee, MapPin, Copy, Check } from 'lucide-react';
import { useSubmit } from './useSubmit.js';

const TIPS = [
  { name: 'Morning coffee', place: 'Kaffe Nord, 3 min walk', icon: Coffee },
  { name: 'Sunset walk', place: 'Harbour promenade, 10 min walk', icon: MapPin },
  { name: 'Dinner', place: 'Trattoria Lume, booking recommended', icon: MapPin }
];

export default function App() {
  useEffect(() => { document.title = 'Welcome to Casa Mira'; }, []);
  const [copied, setCopied] = useState(false);
  const [form, submit] = useSubmit('requests', 'Guest request');
  function copy() {
    navigator.clipboard?.writeText('casamira-guest').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }
  return (
    <div className="min-h-screen bg-teal-50 text-slate-900">
      <main className="mx-auto max-w-md px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Casa Mira</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome, make yourself at home.</h1>
        <div className="mt-8 grid gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Wifi size={18} /> Wi-Fi</h2>
            <p className="mt-2 text-slate-600">Network: CasaMira-Guest</p>
            <button onClick={copy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-white">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy password'}
            </button>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold"><LogOut size={18} /> Check-out</h2>
            <p className="mt-2 text-slate-600">By 11:00. Leave keys on the kitchen table. Late check-out on request.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Local favourites</h2>
            <ul className="mt-3 space-y-3">
              {TIPS.map(t => (
                <li key={t.name} className="flex gap-3"><t.icon className="mt-0.5 text-teal-700" size={18} /><span><strong>{t.name}</strong><br /><span className="text-slate-600">{t.place}</span></span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Need anything?</h2>
            {form.sent ? <p className="mt-3 text-teal-700">Thanks, we have your request and will reply soon.</p> : (
              <form onSubmit={e => { e.preventDefault(); submit(Object.fromEntries(new FormData(e.target))); }} className="mt-3 grid gap-3">
                <input required name="name" placeholder="Your name" className="rounded-lg border border-slate-200 px-3 py-2" />
                <textarea required name="request" rows="3" placeholder="Extra towels, late check-out, taxi…" className="rounded-lg border border-slate-200 px-3 py-2" />
                <button disabled={form.sending} className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white">{form.sending ? 'Sending…' : 'Send request'}</button>
                {form.error && <p className="text-rose-600">{form.error}</p>}
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
`}},
{id:'saas-landing',name:'SaaS landing page',category:'Marketing',description:'Hero, features, pricing, FAQ and a waitlist that collects sign-ups.',
 files:{'src/backend.json':JSON.stringify({collections:{waitlist:{access:'submit-only'}}},null,2)+'\n',
 'src/App.jsx':`import { useEffect, useState } from 'react';
import { collection } from 'kairoq';
import { Zap, ShieldCheck, BarChart3, Check } from 'lucide-react';

const FEATURES = [
  { icon: Zap, title: 'Set up in minutes', text: 'Connect your tools and see your first report the same day.' },
  { icon: BarChart3, title: 'Numbers you trust', text: 'One source of truth for revenue, churn and growth.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Your data stays yours, encrypted at rest and in transit.' }
];
const PLANS = [
  { name: 'Starter', price: 0, perks: ['1 workspace', 'Weekly reports', 'Email support'] },
  { name: 'Growth', price: 29, perks: ['5 workspaces', 'Daily reports', 'Slack alerts'], featured: true },
  { name: 'Scale', price: 99, perks: ['Unlimited workspaces', 'Custom metrics', 'Priority support'] }
];
const FAQ = [
  ['Is there a free plan?', 'Yes. Starter is free forever for one workspace.'],
  ['Can I cancel anytime?', 'Yes, plans are monthly and you can cancel in one click.'],
  ['Do you offer discounts?', 'Nonprofits and students get 50% off. Just ask.']
];

export default function App() {
  useEffect(() => { document.title = 'Northstar · Metrics for small teams'; }, []);
  const [status, setStatus] = useState('');
  async function join(e) {
    e.preventDefault();
    setStatus('sending');
    try { await collection('waitlist').create({ email: new FormData(e.target).get('email') }); setStatus('done'); }
    catch (err) { setStatus(err.message); }
  }
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">Northstar</span>
        <a href="#pricing" className="text-sm font-medium text-slate-600">Pricing</a>
      </nav>
      <header className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Metrics your whole team understands</h1>
        <p className="mt-6 text-lg text-slate-600">Northstar turns your billing and product data into a clear weekly story. No spreadsheets.</p>
        {status === 'done' ? <p className="mt-8 font-semibold text-indigo-600">You are on the list. We will be in touch soon.</p> : (
          <form onSubmit={join} className="mx-auto mt-8 flex max-w-md gap-2">
            <input required type="email" name="email" placeholder="you@company.com" className="flex-1 rounded-lg border border-slate-300 px-4 py-3" />
            <button disabled={status === 'sending'} className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white">Join waitlist</button>
          </form>
        )}
        {status && status !== 'done' && status !== 'sending' && <p className="mt-3 text-rose-600">{status}</p>}
      </header>
      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm"><f.icon className="text-indigo-600" /><h3 className="mt-4 font-semibold">{f.title}</h3><p className="mt-2 text-slate-600">{f.text}</p></div>
          ))}
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.name} className={'rounded-2xl border p-6 ' + (p.featured ? 'border-indigo-600 shadow-lg' : 'border-slate-200')}>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-4 text-4xl font-bold">\${p.price}<span className="text-base font-normal text-slate-500">/mo</span></p>
              <ul className="mt-6 space-y-2">{p.perks.map(x => <li key={x} className="flex gap-2"><Check size={18} className="text-indigo-600" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-3xl font-bold">Questions</h2>
        {FAQ.map(([q, a]) => <details key={q} className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-slate-600">{a}</p></details>)}
      </section>
    </div>
  );
}
`}},
{id:'crm',name:'Team CRM',category:'Business',description:'Sign in, track leads by stage and value, and see the pipeline total.',
 files:{'src/backend.json':JSON.stringify({collections:{leads:{access:'shared'}}},null,2)+'\n',
 'src/App.jsx':`import { useEffect, useMemo, useState } from 'react';
import { auth, collection } from 'kairoq';
import { LogOut, Plus } from 'lucide-react';

const leads = collection('leads');
const STAGES = ['New', 'Contacted', 'Proposal', 'Won', 'Lost'];

function SignIn() {
  const [mode, setMode] = useState('signIn');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    setError('');
    try { mode === 'signIn' ? await auth.signIn(f.get('email'), f.get('password')) : await auth.signUp(f.get('email'), f.get('password')); }
    catch (err) { setError(err.message); }
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-24 grid max-w-sm gap-3 rounded-2xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">Pipeline</h1>
      <input required type="email" name="email" placeholder="Email" className="rounded-lg border px-3 py-2" />
      <input required type="password" name="password" minLength="8" placeholder="Password" className="rounded-lg border px-3 py-2" />
      <button className="rounded-lg bg-slate-900 py-2 font-semibold text-white">{mode === 'signIn' ? 'Sign in' : 'Create account'}</button>
      <button type="button" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} className="text-sm text-slate-600">{mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </form>
  );
}

export default function App() {
  useEffect(() => { document.title = 'Pipeline CRM'; }, []);
  const [user, setUser] = useState(auth.user());
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => auth.onChange(setUser), []);
  useEffect(() => { if (user) leads.list({ limit: 200 }).then(setItems).catch(e => setError(e.message)); }, [user]);
  const total = useMemo(() => items.filter(l => l.stage !== 'Lost').reduce((n, l) => n + Number(l.value || 0), 0), [items]);
  if (!user) return <div className="min-h-screen bg-slate-100"><SignIn /></div>;
  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const lead = await leads.create({ ...f, value: Number(f.value || 0), stage: 'New' });
    setItems([lead, ...items]);
    e.target.reset();
  }
  async function move(lead, stage) {
    const updated = await leads.update(lead.id, { stage });
    setItems(items.map(l => (l.id === lead.id ? updated : l)));
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold">Pipeline <span className="ml-3 text-base font-normal text-slate-500">Open value \${total.toLocaleString()}</span></h1>
        <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-sm text-slate-600"><LogOut size={16} /> {user.email}</button>
      </header>
      <form onSubmit={add} className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2 px-6">
        <input required name="name" placeholder="Company or contact" className="flex-1 rounded-lg border px-3 py-2" />
        <input name="value" type="number" min="0" placeholder="Value ($)" className="w-36 rounded-lg border px-3 py-2" />
        <button className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white"><Plus size={16} /> Add lead</button>
      </form>
      {error && <p className="mx-auto max-w-6xl px-6 text-rose-600">{error}</p>}
      <main className="mx-auto grid max-w-6xl gap-4 overflow-x-auto px-6 py-6 md:grid-cols-5">
        {STAGES.map(stage => (
          <section key={stage} className="min-w-[200px] rounded-xl bg-slate-200/60 p-3">
            <h2 className="text-sm font-semibold text-slate-600">{stage} · {items.filter(l => l.stage === stage).length}</h2>
            {items.filter(l => l.stage === stage).map(l => (
              <article key={l.id} className="mt-3 rounded-lg bg-white p-3 shadow-sm">
                <p className="font-medium">{l.name}</p>
                <p className="text-sm text-slate-500">\${Number(l.value || 0).toLocaleString()}</p>
                <select value={l.stage} onChange={e => move(l, e.target.value)} className="mt-2 w-full rounded border px-2 py-1 text-sm">{STAGES.map(s => <option key={s}>{s}</option>)}</select>
              </article>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
`}},
{id:'booking',name:'Appointment booking',category:'Services',description:'Services, prices and an appointment request form for salons, clinics and studios.',
 files:{'src/backend.json':JSON.stringify({collections:{appointments:{access:'submit-only'}},email:true},null,2)+'\n','src/useSubmit.js':FORM_HOOK,
 'src/App.jsx':`import { useEffect, useState } from 'react';
import { Scissors, CalendarCheck } from 'lucide-react';
import { useSubmit } from './useSubmit.js';

const SERVICES = [
  { name: 'Cut & finish', time: '45 min', price: 55 },
  { name: 'Colour', time: '90 min', price: 120 },
  { name: 'Blow-dry', time: '30 min', price: 35 }
];
const TIMES = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

export default function App() {
  useEffect(() => { document.title = 'Studio Fern · Book online'; }, []);
  const [service, setService] = useState(SERVICES[0].name);
  const [time, setTime] = useState(TIMES[0]);
  const [form, submit] = useSubmit('appointments', 'New appointment request');
  return (
    <div className="min-h-screen bg-emerald-50 text-emerald-950">
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="flex items-center gap-3 text-4xl font-semibold"><Scissors /> Studio Fern</h1>
        <p className="mt-3 text-emerald-800">Pick a service and a time. We confirm every request within a few hours.</p>
        {form.sent ? (
          <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow"><CalendarCheck className="mx-auto text-emerald-600" size={40} /><p className="mt-4 text-lg font-semibold">Request sent</p><p className="text-emerald-800">{service} at {time}. Watch your inbox for confirmation.</p></div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); submit({ ...Object.fromEntries(new FormData(e.target)), service, time }); }} className="mt-10 space-y-8">
            <fieldset><legend className="font-semibold">Service</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SERVICES.map(s => (
                  <button type="button" key={s.name} onClick={() => setService(s.name)} className={'rounded-xl border p-4 text-left ' + (service === s.name ? 'border-emerald-600 bg-white shadow' : 'border-emerald-200')}>
                    <span className="block font-medium">{s.name}</span><span className="text-sm text-emerald-700">{s.time} · \${s.price}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset><legend className="font-semibold">Day and time</legend>
              <input required type="date" name="date" className="mt-3 rounded-lg border border-emerald-200 px-3 py-2" />
              <div className="mt-3 flex flex-wrap gap-2">{TIMES.map(t => <button type="button" key={t} onClick={() => setTime(t)} className={'rounded-full px-4 py-2 ' + (time === t ? 'bg-emerald-600 text-white' : 'bg-white')}>{t}</button>)}</div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required name="name" placeholder="Your name" className="rounded-lg border border-emerald-200 px-3 py-2" />
              <input required type="email" name="email" placeholder="Email" className="rounded-lg border border-emerald-200 px-3 py-2" />
            </div>
            <button disabled={form.sending} className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white">{form.sending ? 'Sending…' : 'Request appointment'}</button>
            {form.error && <p className="text-rose-600">{form.error}</p>}
          </form>
        )}
      </main>
    </div>
  );
}
`}},
{id:'portfolio',name:'Portfolio',category:'Personal',description:'A clean personal site with projects, an about section and a contact form.',
 files:{'src/backend.json':JSON.stringify({collections:{messages:{access:'submit-only'}},email:true},null,2)+'\n','src/useSubmit.js':FORM_HOOK,
 'src/App.jsx':`import { useEffect } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { useSubmit } from './useSubmit.js';

const WORK = [
  { title: 'Harbour Coffee', kind: 'Brand & website', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900' },
  { title: 'Fieldnotes App', kind: 'Product design', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=900' },
  { title: 'Lumen Studio', kind: 'Art direction', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900' }
];

export default function App() {
  useEffect(() => { document.title = 'Alex Rivera · Designer'; }, []);
  const [form, submit] = useSubmit('messages', 'New message from your portfolio');
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto max-w-5xl px-6">
        <header className="py-24">
          <p className="text-neutral-400">Alex Rivera</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">I design calm, useful products for small teams.</h1>
        </header>
        <section className="grid gap-6 md:grid-cols-3">
          {WORK.map(w => (
            <article key={w.title} className="group">
              <img src={w.image} alt={w.title} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <h2 className="mt-3 flex items-center gap-1 font-medium">{w.title} <ArrowUpRight size={16} className="opacity-0 transition group-hover:opacity-100" /></h2>
              <p className="text-sm text-neutral-400">{w.kind}</p>
            </article>
          ))}
        </section>
        <section className="grid gap-12 py-24 md:grid-cols-2">
          <div><h2 className="text-2xl font-semibold">About</h2><p className="mt-4 text-neutral-400">Ten years designing brands and apps for cafés, studios and startups. Currently taking on two new projects for the spring.</p></div>
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Mail size={20} /> Say hello</h2>
            {form.sent ? <p className="mt-4 text-emerald-400">Thanks! I will reply within two days.</p> : (
              <form onSubmit={e => { e.preventDefault(); submit(Object.fromEntries(new FormData(e.target))); }} className="mt-4 grid gap-3">
                <input required name="name" placeholder="Name" className="rounded-lg bg-neutral-900 px-3 py-2" />
                <input required type="email" name="email" placeholder="Email" className="rounded-lg bg-neutral-900 px-3 py-2" />
                <textarea required name="message" rows="4" placeholder="Tell me about your project" className="rounded-lg bg-neutral-900 px-3 py-2" />
                <button disabled={form.sending} className="rounded-lg bg-white py-2 font-semibold text-neutral-950">{form.sending ? 'Sending…' : 'Send message'}</button>
                {form.error && <p className="text-rose-400">{form.error}</p>}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
`}}
];
for(const t of TEMPLATES){t.files={'src/main.jsx':MAIN,'src/index.css':CSS,...t.files}}
// Larger templates live as real project folders under templates/<id>/.
function folder(name){
 const fs=require('fs'),path=require('path'),root=path.join(__dirname,'templates',name),files={};
 (function walk(dir){for(const f of fs.readdirSync(dir).sort()){const p=path.join(dir,f);if(fs.statSync(p).isDirectory())walk(p);else files[path.relative(root,p).split(path.sep).join('/')]=fs.readFileSync(p,'utf8')}})(root);
 return files;
}
TEMPLATES.unshift({id:'calorie-tracker',name:'Calorie & fitness tracker',category:'Health',description:'A phone-first app: daily calorie and macro targets, a food database with search, water, workouts, progress charts and AI meal estimates. Installable on iPhone and Android.',mobile:{name:'Plate & Pulse',short_name:'Plate',theme_color:'#0c1222'},get files(){return folder('calorie-tracker')}});
TEMPLATES.unshift({id:'boutique-hotel',name:'Boutique hotel',category:'Hospitality',description:'Rooms, live availability and booking (no double bookings), guest accounts with My stays, and a front-desk dashboard with charts. Add team emails as the OWNER_EMAILS server secret.',get files(){return folder('boutique-hotel')}});
TEMPLATES.splice(1,0,{id:'travellez',name:'Corporate travel & spend',category:'Travel',description:'Travellez: a marketing site (platform, smart itinerary, industries, pricing with a sales form) and a signed-in workspace for trips, approvals, spend, travelers and policy controls. The workflow rules live in SQL.',get files(){return folder('travellez')}});
function list(){return TEMPLATES.map(({files,...t})=>t)}
function get(id){return TEMPLATES.find(t=>t.id===id)||null}
module.exports={list,get,TEMPLATES};
