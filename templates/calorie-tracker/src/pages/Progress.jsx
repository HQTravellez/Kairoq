import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, ReferenceLine, Tooltip, AreaChart, Area, Cell } from 'recharts';
import { Flame, TrendingDown, TrendingUp, Award } from 'lucide-react';
import { api, todayISO, shiftDay, fmt } from '../lib/fit.js';

export default function Progress({ profile, onProfileChange }) {
  const [stats, setStats] = useState(null);
  const [kg, setKg] = useState('');
  const load = () => api('stats', { day: todayISO() }).then(setStats).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const week = useMemo(() => {
    if (!stats) return [];
    const eaten = Object.fromEntries(stats.eaten.map((d) => [d.day, d.kcal]));
    return Array.from({ length: 7 }, (_, i) => { const d = shiftDay(todayISO(), i - 6); return { day: format(parseISO(d), 'EEE'), kcal: eaten[d] || 0 }; });
  }, [stats]);
  const logged = week.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((n, d) => n + d.kcal, 0) / logged.length) : 0;
  const weights = stats ? stats.weights.map((w) => ({ day: format(parseISO(w.day), 'd MMM'), kg: w.kg })) : [];
  const change = weights.length > 1 ? weights.at(-1).kg - weights[0].kg : 0;
  async function logWeight(e) {
    e.preventDefault();
    try { await api('weight', { day: todayISO(), kg: Number(kg) }); setKg(''); toast.success('Weight saved'); load(); onProfileChange(); }
    catch (err) { toast.error(err.message); }
  }
  return (
    <div className="mx-auto max-w-md px-5 pt-6 lg:max-w-none lg:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Progress</h1>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[[Flame, stats ? stats.streak : '–', 'day streak', '#ffb547'], [Award, avg ? fmt(avg) : '–', 'avg kcal / day', '#34d399'], [change <= 0 ? TrendingDown : TrendingUp, (change > 0 ? '+' : '') + change.toFixed(1), 'kg change', '#7c6cff']].map(([Icon, v, label, c]) => (
          <div key={label} className="card px-4 py-4"><Icon size={18} style={{ color: c }} aria-hidden="true" /><p className="tabular mt-2 text-2xl font-extrabold">{v}</p><p className="text-xs font-semibold text-slate-500">{label}</p></div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-baseline justify-between"><h2 className="font-bold">This week</h2><p className="text-xs font-semibold text-slate-400">Goal {fmt(profile.kcal_target)} kcal</p></div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ left: -18, right: 4 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                <Tooltip cursor={{ fill: '#f2f3ee' }} contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }} formatter={(v) => [fmt(v) + ' kcal', 'Eaten']} />
                <ReferenceLine y={profile.kcal_target} stroke="#0c1222" strokeDasharray="4 4" />
                <Bar dataKey="kcal" radius={[10, 10, 10, 10]} maxBarSize={30} isAnimationActive={false}>
                  {week.map((d) => <Cell key={d.day} fill={d.kcal > profile.kcal_target * 1.05 ? '#ff6b9a' : '#c6f432'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <h2 className="font-bold">Weight</h2>
          <div className="mt-4 h-40">
            {weights.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weights} margin={{ left: -18, right: 4 }}>
                  <defs><linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c6cff" stopOpacity={0.3} /><stop offset="100%" stopColor="#7c6cff" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none' }} formatter={(v) => [v + ' kg', 'Weight']} />
                  <Area type="monotone" dataKey="kg" stroke="#7c6cff" strokeWidth={3} fill="url(#wfill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-center text-sm text-slate-400">Log your weight on a few days to see the trend.</p>}
          </div>
          <form onSubmit={logWeight} className="mt-4 flex gap-2">
            <label className="flex-1"><span className="sr-only">Today's weight in kg</span><input type="number" step="0.1" inputMode="decimal" required value={kg} onChange={(e) => setKg(e.target.value)} placeholder={'Today, kg (last ' + profile.weight_kg + ')'} className="field" /></label>
            <button className="btn">Save</button>
          </form>
        </section>
      </div>
    </div>
  );
}
