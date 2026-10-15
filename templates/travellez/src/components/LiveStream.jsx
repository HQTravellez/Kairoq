import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Check, Loader2, Plane, Hotel, Car, TrainFront } from 'lucide-react';

const STEPS = ['Searching global hotels, flights and rail', 'Applying your policy and negotiated rates', 'Sequencing flights, stays and ground', 'Trip assembled and ready for approval'];
const FLIGHTS = [['AC 795', 'YYZ → SFO', '8:15a – 10:52a', '$486', 'In policy'], ['UA 512', 'SFO → ORD', '11:05a – 4:40p', '$521', 'In policy'], ['BA 118', 'LHR → JFK', '9:30a – 12:20p', '$742', 'Negotiated'], ['LH 401', 'FRA → BOS', '10:05a – 12:35p', '$618', 'In policy'], ['DL 218', 'YVR → DFW', '6:40a – 12:20p', '$734', 'Out of policy']];
const STAYS = [['The Clancy', 'San Francisco', '$268', 'Corporate rate · 4.7'], ['Ace Hotel', 'Chicago', '$212', 'Negotiated · 4.5'], ['citizenM Tower', 'London', '$194', 'Corporate rate · 4.6'], ['Kimpton Gray', 'Boston', '$241', 'In policy · 4.8'], ['Hyatt Centric', 'Dallas', '$176', 'Negotiated · 4.4']];
const GROUND = [[Car, 'Hertz', 'Intermediate · SFO', '$54/day'], [TrainFront, 'Amtrak Acela', 'BOS → NYP', '$118'], [Car, 'Enterprise', 'Compact · DFW', '$41/day'], [TrainFront, 'Eurostar', 'LON → PAR', '$96'], [Car, 'Sixt', 'Estate · FRA', '$63/day']];

// "Flights, stays and ground. Live, in one stream." (sample inventory)
function Column({ items, render, speed }) {
  return (
    <div className="fade-edges h-[460px] overflow-hidden">
      <motion.div animate={{ y: ['0%', '-50%'] }} transition={{ duration: speed, repeat: Infinity, ease: 'linear' }} className="space-y-2.5">
        {[...items, ...items].map((x, i) => <div key={i}>{render(x)}</div>)}
      </motion.div>
    </div>
  );
}
export default function LiveStream() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 2)), 1100); return () => clearInterval(t); }, []);
  return (
    <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-24 lg:grid-cols-[0.9fr_1.4fr] lg:px-8">
      <div>
        <p className="eyebrow">One search, everything moves</p>
        <h2 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.02] sm:text-5xl">Flights, stays and ground. <span className="text-[#ef3444]">Live, in one stream.</span></h2>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#5f646d]">Travellez pulls real inventory from GDS and direct partners, prices it against your negotiated rates, and assembles the trip while you watch.</p>
        <div className="card mt-8 max-w-md p-4">
          <p className="flex items-center gap-2 rounded-full border border-[#edebe8] px-4 py-2.5 text-sm"><Search size={15} className="text-[#8a8e96]" />Toronto → San Francisco, Tue–Thu, hotel + car</p>
          <ul className="mt-3 space-y-2 text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className={'flex items-center gap-2.5 ' + (i <= step ? 'text-[#14161a]' : 'text-[#b4b7bd]')}>
                <span className={'grid h-5 w-5 place-items-center rounded-full ' + (i < step ? 'bg-[#ef3444] text-white' : 'border border-[#e3e1dd]')}>{i < step ? <Check size={12} /> : i === step ? <Loader2 size={12} className="animate-spin text-[#ef3444]" /> : null}</span>{s}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-bold">$412 cheaper than the default booking path.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-hidden="true">
        <Column speed={26} items={FLIGHTS} render={([code, route, time, price, tag]) => (
          <div className="rounded-2xl border border-[#edebe8] border-l-[3px] border-l-[#ef3444] bg-white p-3 text-xs">
            <div className="flex justify-between font-bold"><span className="flex items-center gap-1"><Plane size={12} className="text-[#ef3444]" />{code}</span><span>{price}</span></div>
            <p className="mt-1 text-[#5f646d]">{route}</p><p className="text-[#8a8e96]">{time}</p>
            <span className={'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (tag === 'Out of policy' ? 'bg-[#fdf0f1] text-[#d0202f]' : 'bg-[#e8f6ee] text-[#17804a]')}>{tag}</span>
          </div>)} />
        <Column speed={32} items={STAYS} render={([name, city, price, tag]) => (
          <div className="rounded-2xl border border-[#edebe8] bg-white p-3 text-xs">
            <div className="flex justify-between"><span className="flex items-center gap-1.5 font-bold"><Hotel size={12} className="text-[#5f646d]" />{name}</span><span className="font-bold">{price}</span></div>
            <p className="mt-1 text-[#5f646d]">{city} <span className="text-[#8a8e96]">· / night</span></p><p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a8e96]">{tag}</p>
          </div>)} />
        <div className="hidden sm:block"><Column speed={22} items={GROUND} render={([Icon, name, sub, price]) => (
          <div className="flex items-center justify-between rounded-2xl border border-[#edebe8] bg-white p-3 text-xs"><span className="flex items-center gap-2"><Icon size={14} className="text-[#5f646d]" /><span><b className="block">{name}</b><span className="text-[#8a8e96]">{sub}</span></span></span><b>{price}</b></div>)} /></div>
      </div>
    </section>
  );
}
