import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Users, CalendarDays, Wallet, ShieldCheck, ArrowRight, Plane, Hotel, Car } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { money } from '../lib/format.js';

// Reads a one-sentence request in the browser (no AI call, nothing is booked) and lays out
// the structure Travellez would create: destination, people, dates, budget and policy checks.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
export function parseRequest(s) {
  const t = String(s || '');
  const dest = (/\b(?:to|in)\s+([A-Z][a-zA-ZÀ-ſ]+(?:\s[A-Z][a-zA-ZÀ-ſ]+)?)/.exec(t) || /^([A-Z][a-zA-ZÀ-ſ]+)/.exec(t.trim()) || [])[1] || '';
  const ppl = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:people|persons|travell?ers|colleagues|of us|guests)/i.exec(t) || /\bfor\s+(\d+)\b/i.exec(t);
  const people = ppl ? (NUM[ppl[1].toLowerCase()] || Number(ppl[1])) : 1;
  // "12 to 14 March", "4-6 June", "3 May": the first number(s) followed by a month name.
  const d = [...t.matchAll(/(\d{1,2})(?:\s*(?:to|-|–|until)\s*(\d{1,2}))?\s+([A-Za-z]{3,})/g)].find((m) => MONTHS.includes(m[3].slice(0, 3).toLowerCase()));
  let start = null, end = null;
  if (d) {
    const m = MONTHS.indexOf(d[3].slice(0, 3).toLowerCase()), now = new Date();
    let y = now.getFullYear(); if (new Date(y, m, Number(d[1])) < now) y++;
    start = new Date(y, m, Number(d[1])); end = new Date(y, m, Number(d[2] || d[1]));
  }
  const b = /(?:under|below|max(?:imum)?|budget(?: of)?)\s*[€$£]?\s*(\d[\d,.]*)\s*(k)?\s*(each|per person|pp|total)?/i.exec(t);
  let budget = null, each = false;
  if (b) { budget = Number(b[1].replace(/[,.]/g, '')) * (b[2] ? 1000 : 1); each = /each|per person|pp/i.test(b[3] || ''); }
  const total = budget ? (each ? budget * people : budget) : null;
  const nightsN = start && end ? Math.max(1, Math.round((end - start) / 86400000)) : null;
  return { dest, people, start, end, nights: nightsN, total, perPerson: total ? Math.round(total / people) : null };
}
const fmt = (d) => d ? d.toLocaleDateString('en', { day: 'numeric', month: 'short' }) : '—';

export default function SmartItinerary() {
  const [text, setText] = useState('Lisbon offsite for 6 people, 12 to 14 March, under €900 each');
  const r = useMemo(() => parseRequest(text), [text]);
  const cap = 1500, hotelCap = 180;
  const split = r.perPerson ? { flight: Math.round(r.perPerson * 0.45), hotel: Math.round(r.perPerson * 0.4), ground: Math.round(r.perPerson * 0.15) } : null;
  const checks = [
    r.perPerson != null && { ok: r.perPerson <= cap, text: r.perPerson <= cap ? 'Per-person budget is within the ' + money(cap) + ' trip cap' : 'Per-person budget is above the ' + money(cap) + ' trip cap: needs a manager' },
    split && r.nights && { ok: split.hotel / r.nights <= hotelCap, text: 'Hotel budget ≈ ' + money(Math.round(split.hotel / r.nights)) + ' a night (cap ' + money(hotelCap) + ')' },
    r.start && { ok: (r.start - new Date()) / 86400000 >= 7, text: (r.start - new Date()) / 86400000 >= 7 ? 'Booked at least 7 days ahead' : 'Less than 7 days ahead: needs a manager' }
  ].filter(Boolean);
  return (
    <>
      <PageHero eyebrow="Smart Itinerary" title="Describe the trip in one sentence." text="Travellez pulls out the destination, the people, the dates and the budget, splits the budget sensibly and checks it against your policy before anyone books anything." />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <label htmlFor="trip-sentence" className="block text-sm font-semibold text-slate-700">Your trip, in your words</label>
        <textarea id="trip-sentence" rows={2} value={text} onChange={(e) => setText(e.target.value)} className="input mt-2 text-lg" />
        <p className="mt-2 text-xs text-slate-500">This demo runs in your browser. Nothing is booked or sent. Try “Team visit to Berlin for 3 people, 4 to 6 June, budget €3000 total”.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-4">
          {[[MapPin, 'Destination', r.dest || 'Add a city'], [Users, 'Travelers', String(r.people)], [CalendarDays, 'Dates', r.start ? fmt(r.start) + ' – ' + fmt(r.end) + (r.nights ? ' · ' + r.nights + ' night' + (r.nights > 1 ? 's' : '') : '') : 'Add dates'], [Wallet, 'Budget', r.total ? money(r.total) + ' · ' + money(r.perPerson) + ' pp' : 'Add a budget']].map(([Icon, k, v]) => (
            <motion.div layout key={k} className="card p-4"><Icon size={18} className="text-indigo-600" /><p className="mt-3 text-xs text-slate-500">{k}</p><AnimatePresence mode="wait"><motion.p key={v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 font-semibold text-slate-900">{v}</motion.p></AnimatePresence></motion.div>
          ))}
        </div>
        {split && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h2 className="font-display text-xl font-semibold text-slate-900">Suggested budget per person</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {[[Plane, 'Flights', split.flight], [Hotel, 'Hotel', split.hotel], [Car, 'Ground & meals', split.ground]].map(([Icon, k, v]) => (
                  <li key={k} className="flex items-center gap-3"><Icon size={16} className="text-teal-600" /><span className="flex-1 text-slate-700">{k}</span><span className="font-semibold text-slate-900">{money(v)}</span></li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <h2 className="font-display text-xl font-semibold text-slate-900">Policy check</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {checks.map((c) => <li key={c.text} className="flex gap-3"><ShieldCheck size={16} className={'mt-0.5 shrink-0 ' + (c.ok ? 'text-emerald-600' : 'text-amber-500')} /><span className={c.ok ? 'text-slate-700' : 'font-medium text-amber-700'}>{c.text}</span></li>)}
              </ul>
            </div>
          </div>
        )}
        <div className="mt-12 rounded-3xl bg-slate-900 p-8 text-white sm:flex sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-semibold">Ready to send real trips for approval?</p>
          <Link to="/app" className="btn-light mt-4 sm:mt-0">Open your workspace <ArrowRight size={16} /></Link>
        </div>
      </section>
    </>
  );
}
