import { useState } from 'react';
import { functions } from 'kairoq';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';

// Recoverable spend on the visitor's own numbers. Air and ground split the non-hotel
// spend 65/35; every lever is a share of the part of the budget it acts on.
export const LEVERS = [
  { id: 'consolidate', pct: 0.08, of: 'total', label: '8% of total spend', title: 'Consolidate into one system', text: 'Recovers duplicate spend leaking across personal cards and shadow booking.' },
  { id: 'caps', pct: 0.10, of: 'hotel', label: '10% of hotel spend', title: 'Hotel caps by city tier', text: 'A flat per-night cap overpays in secondary markets, underpays in primary ones.' },
  { id: 'audit', pct: 0.04, of: 'airhotel', label: '4% of air + hotel spend', title: 'Monthly policy audit', text: "Surfaces repeat offenders before quarter close, while it's still fixable." },
  { id: 'bundle', pct: 0.05, of: 'air', label: '5% of airfare', title: 'Bundle adjacent trips', text: 'Coordinates teams hitting the same client or city in the same window.' },
  { id: 'rail', pct: 0.15, of: 'ground', label: '15% of ground spend', title: 'Shift short legs to rail', text: 'Sub-4-hour legs, faster door-to-door, cheaper, lower carbon.' },
  { id: 'rates', pct: 0.07, of: 'hotel', label: '7% of hotel spend', title: 'Negotiated hotel rates', text: 'Kicks in once you have enough volume to negotiate with.' }
];
export function savings({ travelers, trips, cost, hotelShare }, on) {
  const total = travelers * trips * cost, hotel = total * hotelShare / 100, rest = total - hotel;
  const base = { total, hotel, air: rest * 0.65, ground: rest * 0.35, airhotel: hotel + rest * 0.65 };
  const values = Object.fromEntries(LEVERS.map((l) => [l.id, Math.round(base[l.of] * l.pct)]));
  const recoverable = LEVERS.filter((l) => on[l.id]).reduce((n, l) => n + values[l.id], 0);
  return { total, values, recoverable, share: total ? Math.round(recoverable / total * 100) : 0 };
}
const SLIDERS = [['travelers', 'Travelers', 1, 500, 1, (v) => v], ['trips', 'Trips per traveler / year', 1, 40, 1, (v) => v], ['cost', 'Average cost per trip', 200, 6000, 50, (v) => money(v, 'USD')], ['hotelShare', 'Hotel share of spend', 5, 70, 1, (v) => v + '%']];

export default function SavingsCalculator() {
  const [n, setN] = useState({ travelers: 40, trips: 6, cost: 1800, hotelShare: 29 });
  const [on, setOn] = useState(Object.fromEntries(LEVERS.map((l) => [l.id, true])));
  const [lead, setLead] = useState({ company: '', email: '' }), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  const r = savings(n, on);
  async function send(e) {
    e.preventDefault(); setBusy(true);
    try { await functions.invoke('lead', { kind: 'breakdown', ...lead, message: JSON.stringify({ ...n, recoverable: r.recoverable }) }); setSent(true); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="panel p-6">
        {SLIDERS.map(([k, label, min, max, step, show]) => (
          <div key={k} className="mb-5">
            <label htmlFor={'calc-' + k} className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="tabular">{show(n[k])}</span></label>
            <input id={'calc-' + k} type="range" min={min} max={max} step={step} value={n[k]} onChange={(e) => setN({ ...n, [k]: Number(e.target.value) })} className="mt-2 w-full" />
          </div>
        ))}
        <div className="border-t border-[#e6e3de] pt-5"><p className="eyebrow">Annual travel spend</p><p className="mt-1 font-display text-3xl font-bold tabular">{money(r.total, 'USD')}</p></div>
        <div className="mt-4 rounded-2xl bg-[#14161a] p-5 text-white" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Recoverable per year</p>
          <p className="mt-1 font-display text-4xl font-bold text-[#ff5a68] tabular">{money(r.recoverable, 'USD')}</p>
          <p className="mt-1 text-xs text-white/60">{r.share}% of total programme spend</p>
        </div>
        <div className="mt-4 rounded-2xl border border-[#e6e3de] bg-white p-4">
          {sent ? <p className="text-sm font-medium text-[#17804a]">Sent. Your breakdown is on its way to {lead.email}.</p> : (
            <form onSubmit={send}>
              <p className="text-sm font-bold">Get this breakdown in writing</p>
              <p className="mt-1 text-xs text-[#5f646d]">We'll email your numbers, the assumptions, and where to start.</p>
              <label htmlFor="calc-company" className="sr-only">Company name</label><input id="calc-company" required placeholder="Company name" value={lead.company} onChange={(e) => setLead({ ...lead, company: e.target.value })} className="input mt-3" />
              <label htmlFor="calc-email" className="sr-only">Work email</label><input id="calc-email" type="email" required placeholder="Work email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className="input mt-2" />
              <button disabled={busy} className="btn-primary mt-3 w-full">{busy ? 'Sending…' : 'Send me the breakdown'} <ArrowRight size={15} /></button>
              <Link to="/demo" className="mt-2 block text-center text-xs font-semibold text-[#5f646d] hover:text-[#14161a]">Or walk through it with us</Link>
            </form>
          )}
        </div>
      </div>
      <div>
        <h3 className="font-display text-2xl font-bold">Where your budget leaks</h3>
        <p className="mt-1 text-sm text-[#5f646d]">Toggle a lever to see what it's worth on your numbers.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {LEVERS.map((l) => (
            <div key={l.id} className={'rounded-2xl border p-5 transition ' + (on[l.id] ? 'border-[#e6e3de] bg-[#f7f6f3]' : 'border-dashed border-[#e6e3de] bg-white opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f646d]">{l.label}</p>
                <button type="button" role="switch" aria-checked={on[l.id]} aria-label={l.title} onClick={() => setOn({ ...on, [l.id]: !on[l.id] })} className={'relative h-5 w-9 shrink-0 rounded-full transition ' + (on[l.id] ? 'bg-[#ef3444]' : 'bg-[#d9d7d2]')}><span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ' + (on[l.id] ? 'left-[18px]' : 'left-0.5')} /></button>
              </div>
              <p className="mt-2 font-bold">{l.title}</p>
              <p className="mt-1 text-sm text-[#5f646d]">{l.text}</p>
              <p className="mt-3 font-display text-xl font-bold tabular">{money(r.values[l.id], 'USD')}<span className="font-sans text-xs font-medium text-[#8a8e96]"> / year</span></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
