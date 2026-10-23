import { motion } from 'framer-motion';
import { X, Clock, Plane, Hotel, Car, Check, ArrowRight, Globe, BedDouble, Map, Mail, Sheet, Receipt } from 'lucide-react';

const TABS = [[Globe, 'skyscanner.com'], [BedDouble, 'booking.com'], [Map, 'maps.google.com'], [Car, 'avis.ca'], [Mail, 'Re: approve this trip?'], [Sheet, 'Q3-travel-v7.xlsx'], [Receipt, 'receipts (12 missing)']];
const TRIP = [[Plane, 'YYZ to JFK', 'AC 738 · 07:15'], [Hotel, 'Hyatt Midtown', '2 nights · $412'], [Car, 'Avis compact', 'Airport pickup']];

// "Six tabs. Or one trip." The same booking, before and after.
export default function TabsVsTrip() {
  return (
    <section className="border-y border-[#edebe8] bg-[#f7f6f3] py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-8">
        <h2 className="text-balance text-center font-display text-4xl font-bold sm:text-6xl">Six tabs. Or one trip.</h2>
        <p className="mt-3 text-center text-lg text-[#5f646d]">Same booking, two very different afternoons.</p>
        <div className="mt-14 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-3xl border border-[#e6e3de] bg-[#efede9] p-6">
            <div className="flex items-center justify-between text-xs font-semibold text-[#5f646d]"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1"><X size={12} />TODAY</span><span className="inline-flex items-center gap-1"><Clock size={13} />30-45 min</span></div>
            <ul className="mt-5 space-y-2">
              {TABS.map(([Icon, t], i) => (
                <motion.li key={t} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-2.5 rounded-xl border border-[#e3e1dd] bg-white px-4 py-2.5 text-sm text-[#5f646d]" style={{ marginLeft: (i % 3) * 6 }}>
                  <Icon size={15} />{t}
                </motion.li>
              ))}
            </ul>
            <p className="mt-5 text-sm font-medium">Seven tools, zero visibility for finance.</p>
          </div>
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#ef3444] text-white shadow-lg lg:rotate-0"><ArrowRight size={18} className="rotate-90 lg:rotate-0" /></span>
          <div className="card p-6">
            <div className="flex items-center justify-between"><span className="rounded-full bg-[#ef3444] px-2.5 py-1 text-xs font-bold text-white">TRAVELLEZ</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-[#17804a]"><Clock size={13} />6 min</span></div>
            <ul className="mt-5 space-y-2.5">
              {TRIP.map(([Icon, a, b], i) => (
                <motion.li key={a} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 + i * 0.15 }}
                  className="flex items-center gap-3 rounded-2xl border border-[#edebe8] bg-[#fbfaf9] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fdf0f1] text-[#ef3444]"><Icon size={16} /></span>
                  <div className="flex-1"><p className="text-sm font-semibold">{a}</p><p className="text-xs text-[#8a8e96]">{b}</p></div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#17804a]"><Check size={13} />In policy</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-[#f2a7ae] bg-[#fdf0f1] px-4 py-3 text-sm font-semibold"><span>One invoice, coded to R&amp;D</span><span className="tabular text-[#d0202f]">$1,284</span></div>
            <p className="mt-4 text-sm">One tab, approved before the card is charged.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
