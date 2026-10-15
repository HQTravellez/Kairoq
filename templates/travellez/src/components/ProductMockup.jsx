import { Check, Clock, Plane, Hotel, ShieldCheck } from 'lucide-react';

// An illustrative product screen (not live data), used on the marketing pages.
export default function ProductMockup({ compact = false }) {
  const rows = [
    ['Amara O.', 'London → Lisbon', 'Booked', 'bg-emerald-50 text-emerald-700'],
    ['Lucas M.', 'Berlin → Amsterdam', 'Approved', 'bg-indigo-50 text-indigo-700'],
    ['Priya N.', 'Paris → Toronto', 'Needs approval', 'bg-amber-50 text-amber-700']
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white text-left shadow-2xl shadow-indigo-950/40" aria-label="Example of the Travellez dashboard">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 text-xs text-slate-400">app.travellez · Dashboard</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {[['Trips this month', '24', Plane], ['Waiting for approval', '3', Clock], ['Within policy', '92%', ShieldCheck]].map(([k, v, Icon]) => (
          <div key={k} className="rounded-xl border border-slate-100 p-3">
            <Icon size={16} className="text-indigo-500" />
            <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{v}</p>
            <p className="text-xs text-slate-500">{k}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="px-5 pb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Upcoming trips</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {rows.map(([who, route, st, cls]) => (
              <li key={who} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{who[0]}</span><span className="font-medium text-slate-800">{who}</span></span>
                <span className="hidden text-slate-500 sm:inline">{route}</span>
                <span className={'pill ' + cls}>{st === 'Booked' && <Check size={12} />}{st}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><Hotel size={14} className="text-teal-600" /> Hotel nights capped at €180 · Trips over €1,500 need a manager</div>
        </div>
      )}
    </div>
  );
}
