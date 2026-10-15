import { Link } from 'react-router-dom';
import { Plane, Clock, CheckCircle2, Wallet, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle } from '../../components/AppShell.jsx';
import { money, niceDate, STATUS, CATEGORIES } from '../../lib/format.js';

export default function Dashboard() {
  const { data } = useWorkspace();
  const { stats, trips, approvals, policy } = data;
  const cur = policy.currency;
  const upcoming = trips.filter((t) => ['approved', 'booked', 'requested'].includes(t.status) && t.departure_date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.departure_date.localeCompare(b.departure_date)).slice(0, 5);
  const pending = approvals.filter((a) => a.status === 'pending').slice(0, 4);
  const kpis = [
    { label: 'Requested', value: stats.requested, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'text-[#d0202f] bg-[#fdf0f1]' },
    { label: 'Booked', value: stats.booked, icon: Plane, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Spend this month', value: money(stats.spend_month, cur), icon: Wallet, tone: 'text-[#17804a] bg-[#e8f6ee]' },
    { label: 'Active travelers', value: stats.active_travelers, icon: Users, tone: 'text-slate-600 bg-slate-100' }
  ];
  const chart = stats.by_category.map((c) => ({ ...c, label: CATEGORIES.find((x) => x.id === c.category).label, color: CATEGORIES.find((x) => x.id === c.category).color }));
  return (
    <>
      <PageTitle title="Dashboard" text="Where your team is going and what it costs."><Link to="/app/trips?new=1" className="btn-primary"><Plane size={16} />Request a trip</Link></PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <span className={'grid h-9 w-9 place-items-center rounded-xl ' + k.tone}><k.icon size={18} /></span>
            <p className="mt-4 font-display text-2xl font-semibold text-slate-900">{k.value}</p>
            <p className="text-sm text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-slate-900">Upcoming trips</h2><Link to="/app/trips" className="text-sm font-medium text-[#d0202f] hover:underline">All trips</Link></div>
          {upcoming.length === 0 ? <p className="mt-6 text-sm text-slate-500">No upcoming trips yet.</p> : (
            <ul className="mt-4 divide-y divide-slate-100">
              {upcoming.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fdf0f1] text-sm font-semibold text-[#d0202f]">{t.traveler[0]}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900">{t.origin} → {t.destination}</p><p className="text-sm text-slate-500">{t.traveler} · {niceDate(t.departure_date)}</p></div>
                  {t.over_policy ? <AlertTriangle size={16} className="text-amber-500" aria-label="Outside policy" /> : null}
                  <span className={'pill capitalize ' + STATUS[t.status]}>{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Spend by category</h2>
          <p className="text-sm text-slate-500">{money(stats.spend_total, cur)} in total · {money(stats.to_pay, cur)} waiting to be paid</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -10 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v) => money(v, cur)} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>{chart.map((c) => <Cell key={c.category} fill={c.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      {pending.length > 0 && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-slate-900">Waiting for your approval</h2><Link to="/app/approvals" className="inline-flex items-center gap-1 text-sm font-medium text-[#d0202f] hover:underline">Review <ArrowRight size={14} /></Link></div>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {pending.map((a) => <li key={a.id} className="rounded-xl border border-slate-100 p-4"><p className="font-medium text-slate-900">{a.requester} → {a.destination}</p><p className="text-sm text-slate-500">{niceDate(a.departure_date)} · {money(a.estimate, cur)}{a.over_policy ? ' · outside policy' : ''}</p></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
