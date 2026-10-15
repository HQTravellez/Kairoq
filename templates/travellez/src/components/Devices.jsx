import { Plane, Hotel, Car, Search, Leaf } from 'lucide-react';

// The Travellez product on a laptop and a phone (sample data).
export default function Devices() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]" aria-label="Travellez on a laptop and a phone">
      <div className="rounded-[22px] border-[10px] border-[#d9d7d2] bg-white shadow-[0_40px_80px_-30px_rgb(20_22_26/.35)]">
        <div className="flex items-center justify-between border-b border-[#edebe8] px-4 py-2.5">
          <span className="font-display text-sm font-bold tracking-[-0.06em] text-[#ef3444]">travellez</span>
          <div className="hidden gap-4 text-[10px] font-semibold text-[#8a8e96] sm:flex"><span className="text-[#ef3444]">Dashboard</span><span>Book travel</span><span>My trips</span><span>Policies</span><span>Employees</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 p-3.5">
          <div className="col-span-3 flex items-center justify-between"><div><p className="text-[13px] font-bold">Welcome back, Maya</p><p className="text-[10px] text-[#8a8e96]">Your team's travel at a glance</p></div><span className="rounded-full border border-[#f6c9cd] px-2.5 py-1 text-[10px] font-semibold text-[#ef3444]">+ Add employee</span></div>
          <div className="row-span-2 overflow-hidden rounded-xl bg-[#14161a] p-3 text-white">
            <p className="text-[10px] text-white/60">Spend this month</p><p className="font-display mt-1 text-xl font-bold tabular">C$24,920</p>
            <div className="mt-4 flex h-16 items-end gap-1">{[38, 52, 44, 70, 58, 82, 64].map((h, i) => <span key={i} className={'flex-1 rounded-t ' + (i === 5 ? 'bg-[#ef3444]' : 'bg-white/20')} style={{ height: h + '%' }} />)}</div>
          </div>
          <div className="rounded-xl border border-[#edebe8] p-3"><p className="font-display text-xl font-bold">12</p><p className="text-[9px] font-semibold uppercase tracking-wider text-[#8a8e96]">Employees onboarded</p></div>
          <div className="rounded-xl border border-[#edebe8] p-3"><p className="font-display text-xl font-bold text-[#ef3444]">3</p><p className="text-[9px] font-semibold uppercase tracking-wider text-[#8a8e96]">Policy flags</p></div>
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-[#edebe8] p-3"><div><p className="text-[10px] text-[#8a8e96]">Carbon this quarter</p><p className="text-sm font-bold">1,152 kg CO₂</p></div><Leaf size={22} className="text-[#17804a]" /></div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-4 w-[150px] rounded-[26px] border-[6px] border-[#14161a] bg-white p-2.5 shadow-2xl sm:-left-10 sm:w-[170px]">
        <span className="font-display text-[11px] font-bold tracking-[-0.06em] text-[#ef3444]">travellez</span>
        <p className="mt-2 text-[11px] font-bold">Where to next?</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#ef3444] px-2 py-1.5 text-[9px] font-semibold text-white"><Search size={10} />Toronto → Calgary</div>
        {[[Plane, 'AC 115 · 07:00', '$412'], [Hotel, 'Hotel Arts · 2n', '$398'], [Car, 'Airport transfer', '$46']].map(([Icon, a, b]) => (
          <div key={a} className="mt-1.5 flex items-center justify-between rounded-md border border-[#edebe8] px-1.5 py-1 text-[8.5px]"><span className="flex items-center gap-1"><Icon size={9} className="text-[#ef3444]" />{a}</span><b>{b}</b></div>
        ))}
        <div className="mt-2 rounded-md bg-[#14161a] py-1 text-center text-[8.5px] font-semibold text-white">Send for approval</div>
      </div>
    </div>
  );
}
