import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plane, Hotel, Car, Briefcase, FileText, Sheet, MapPin } from 'lucide-react';
import { money } from '../lib/format.js';

// "Describe the trip. Watch it build itself." Reads the sentence in the browser and lays out
// the brief Travellez would assemble. Sample prices; nothing is searched or booked.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function parseTrip(t) {
  const s = String(t || '');
  const city = (/\b(?:in|to)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/.exec(s) || [])[1] || '';
  const from = (/^([A-Z][a-zA-Z]+)\s+to\s+/.exec(s.trim()) || [])[1] || 'Toronto';
  const d = [...s.matchAll(/([A-Za-z]{3,})\.?\s+(\d{1,2})|(\d{1,2})\s+([A-Za-z]{3,})/g)].map((m) => m[1] ? [m[1], m[2]] : [m[4], m[3]]).find(([m]) => MONTHS.includes(m.slice(0, 3).toLowerCase()));
  const meetings = Math.max(1, (s.match(/meeting|lunch|dinner|visit|workshop|review/gi) || []).length);
  const client = (/\bat\s+([A-Z][\w&'-]+(?:\s[A-Z][\w&'-]+)?)/.exec(s) || [])[1] || '';
  return { city, from, date: d ? d[0].slice(0, 3) + ' ' + d[1] : '', meetings, client };
}
export default function TripBrief() {
  const [text, setText] = useState('Client lunch at Moretti in Calgary on Aug 12, renewal review nearby after, back the same night');
  const [shown, setShown] = useState(null);
  const p = useMemo(() => parseTrip(text), [text]);
  const plan = shown && [
    [Plane, 'Flight', (shown.from.slice(0, 3).toUpperCase()) + ' → ' + (shown.city || 'YYC').slice(0, 3).toUpperCase() + ' · 07:00', 386, 'In policy'],
    [Briefcase, 'Meeting', (shown.client || 'Client lunch') + ' · 12:30', 0, 'Synced'],
    [Car, 'Ground', 'Car between meetings · 14:00', 48, 'In policy'],
    [Plane, 'Flight', 'Return · 19:40', 178, 'In policy']
  ];
  const spend = plan ? plan.reduce((n, x) => n + x[3], 0) : 0;
  return (
    <section className="paper-grid border-y border-[#edebe8] py-24">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
        <h2 className="text-balance text-center font-display text-4xl font-bold sm:text-5xl">Describe the trip. Watch it build itself.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[17px] text-[#5f646d]">One sentence becomes a policy-checked itinerary, a client ROI case, a mapped route and an approval-ready brief, assembled live, before anyone books.</p>
        <div className="card mt-12 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-[#edebe8] bg-[#f7f6f3] px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e3e1dd]" /><span className="h-2.5 w-2.5 rounded-full bg-[#e3e1dd]" /><span className="h-2.5 w-2.5 rounded-full bg-[#e3e1dd]" /><span className="mx-auto rounded-md bg-white px-3 py-0.5 text-[11px] text-[#8a8e96]">app.travellez.com/trip-brief</span></div>
          <div className="p-5 sm:p-6">
            <form onSubmit={(e) => { e.preventDefault(); setShown(p); }} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="brief-text" className="sr-only">Describe your trip</label>
              <input id="brief-text" value={text} onChange={(e) => setText(e.target.value)} className="input flex-1" placeholder="e.g. Client lunch at Moretti in Toronto on Aug 12, meeting nearby after…" />
              <button className="btn-primary"><Sparkles size={15} />Generate brief</button>
            </form>
            <div className="mt-5 grid gap-4 md:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-[#edebe8] p-4">
                <p className="eyebrow">Itinerary</p>
                {!plan ? <p className="mt-6 pb-6 text-center text-sm text-[#8a8e96]"><MapPin size={18} className="mx-auto mb-2" />Stops appear here as Travellez sequences the trip.</p> : (
                  <ol className="mt-3 space-y-2">
                    <AnimatePresence>{plan.map(([Icon, kind, what, price, tag], i) => (
                      <motion.li key={shown.city + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }} className="flex items-center gap-3 rounded-xl bg-[#fbfaf9] p-3 text-sm">
                        <Icon size={16} className="text-[#ef3444]" /><span className="w-16 text-xs font-semibold text-[#8a8e96]">{kind}</span><span className="flex-1 font-medium">{what}</span>{price ? <b className="tabular">{money(price, 'USD')}</b> : null}<span className="ok">{tag}</span>
                      </motion.li>))}</AnimatePresence>
                  </ol>
                )}
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#edebe8] p-4">
                  <p className="eyebrow">Trip summary</p>
                  <p className="mt-2 font-display text-lg font-bold">{plan ? (shown.city || 'Calgary') + (shown.date ? ', ' + shown.date : '') : 'Waiting on the brief'}</p>
                  <p className="mt-1 text-sm text-[#5f646d]">{plan ? shown.meetings + ' meeting' + (shown.meetings > 1 ? 's' : '') + ' · ' + money(spend, 'USD') + ' estimated spend · 0 policy exceptions' : 'Describe the trip and press Generate brief.'}</p>
                </div>
                <div className="rounded-2xl border border-[#edebe8] p-4">
                  <p className="eyebrow">Supporting documents</p>
                  <p className="mt-2 flex items-center gap-2 text-sm"><FileText size={15} className="text-[#ef3444]" />Renewal_proposal.pdf</p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm"><Sheet size={15} className="text-[#17804a]" />Client_list_Q3.xlsx</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-sm font-semibold">A trip starts as a sentence.</p>
      </div>
    </section>
  );
}
