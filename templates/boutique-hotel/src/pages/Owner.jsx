import { useEffect, useState } from 'react';
import { auth, functions } from 'kairoq';
import { toast } from 'sonner';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import AuthPanel from '../components/AuthPanel.jsx';
import { euro, niceDate } from '../lib/hotel.js';

export default function Owner() {
  const [user, setUser] = useState(auth.user());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => auth.onChange(setUser), []);
  useEffect(() => { if (user) load(); }, [user]);
  async function load(cancel) {
    try { setData(await functions.invoke('owner', cancel ? { cancel } : {})); setError(''); }
    catch (err) { setError(err.message); }
  }
  if (!user) return <div className="px-5 py-16"><AuthPanel title="Team sign-in" intro="For the Casa Azul team." /></div>;
  if (error) return <div className="mx-auto max-w-xl px-5 py-20 text-center"><p className="text-lg text-slate-700">{error}</p><button type="button" onClick={() => auth.signOut()} className="mt-4 text-sm text-[#1d4e89] hover:underline">Sign out</button></div>;
  if (!data) return <p className="px-5 py-20 text-center text-slate-500">Loading…</p>;
  const { totals, occupancy, months, bookings } = data;
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="font-display text-5xl text-[#12345c]">Front desk</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[['Upcoming bookings', totals.upcoming], ['Upcoming room nights', totals.nights], ['Upcoming revenue', euro(totals.revenue)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"><p className="text-sm text-slate-500">{k}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{v}</p></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart title="Occupancy, next 30 days (%)" data={occupancy} x="room" y="percent" />
        <Chart title="Revenue by arrival month (€)" data={months} x="month" y="revenue" />
      </div>
      <h2 className="mt-12 text-xl font-semibold text-slate-900">Bookings</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-black/5 text-slate-500"><tr>{['#', 'Guest', 'Room', 'Dates', 'Guests', 'Total', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-slate-500">{b.id}</td>
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{b.name}</p><p className="text-slate-500">{b.email}</p>{b.message && <p className="mt-1 text-xs text-slate-500">“{b.message}”</p>}</td>
                <td className="px-4 py-3">{b.room}</td>
                <td className="px-4 py-3">{niceDate(b.check_in)} – {niceDate(b.check_out)}</td>
                <td className="px-4 py-3">{b.guests}</td>
                <td className="px-4 py-3">{euro(b.total)}</td>
                <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{b.status}</span></td>
                <td className="px-4 py-3 text-right">{b.status === 'confirmed' && <button type="button" onClick={() => { if (confirm('Cancel booking #' + b.id + '?')) { load(b.id); toast.success('Cancelled'); } }} className="text-xs font-medium text-red-700 hover:underline">Cancel</button>}</td>
              </tr>
            ))}
            {!bookings.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chart({ title, data, x, y }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-medium text-slate-600">{title}</h2>
      <div className="mt-4 h-56">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" /><XAxis dataKey={x} tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} width={44} /><Tooltip /><Bar dataKey={y} fill="#1d4e89" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        ) : <p className="pt-16 text-center text-sm text-slate-400">No data yet</p>}
      </div>
    </div>
  );
}
