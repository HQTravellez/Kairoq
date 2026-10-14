import { useCallback, useEffect, useState } from 'react';
import { Trash2, Flame, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { api, ACTIVITIES, MET, todayISO, fmt } from '../lib/fit.js';

export default function Activity({ profile }) {
  const [type, setType] = useState('running');
  const [minutes, setMinutes] = useState(30);
  const [list, setList] = useState([]);
  const day = todayISO();
  const load = useCallback(() => api('day', { day }).then((d) => setList(d.workouts)).catch((e) => toast.error(e.message)), [day]);
  useEffect(() => { load(); }, [load]);
  const estimate = Math.round(MET[type] * profile.weight_kg * (minutes / 60));
  async function log() {
    try { const r = await api('workout.add', { day, type, minutes }); toast.success('Logged · ' + r.kcal + ' kcal burned'); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function remove(id) { try { await api('workout.remove', { id }); load(); } catch (e) { toast.error(e.message); } }
  const total = list.reduce((n, w) => n + w.kcal, 0);
  return (
    <div className="mx-auto max-w-md px-5 pt-6 lg:max-w-3xl lg:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Activity</h1>
      <p className="mt-1 text-slate-500">Burned calories are added back to today's budget.</p>
      <section className="card mt-6">
        <h2 className="font-bold">What did you do?</h2>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {ACTIVITIES.map((a) => (
            <button key={a.id} type="button" onClick={() => setType(a.id)} aria-pressed={type === a.id} className={'flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold transition ' + (type === a.id ? 'bg-[#0c1222] text-white' : 'bg-[#f2f3ee] text-slate-600 hover:bg-[#e8eae1]')}>
              <span className="text-2xl" aria-hidden="true">{a.emoji}</span>{a.label}
            </button>
          ))}
        </div>
        <label className="mt-6 block" htmlFor="minutes">
          <span className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-1.5"><Timer size={16} aria-hidden="true" />Duration</span><span className="tabular text-lg font-extrabold">{minutes} min</span></span>
          <input id="minutes" type="range" min="5" max="180" step="5" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-3 w-full accent-[#0c1222]" />
        </label>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f2f3ee] px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Flame size={18} className="text-[#ffb547]" aria-hidden="true" />About</span>
          <span className="tabular text-2xl font-extrabold">{fmt(estimate)} kcal</span>
        </div>
        <button type="button" onClick={log} className="btn mt-4 w-full">Log workout</button>
      </section>
      <section className="mt-6">
        <div className="flex items-baseline justify-between"><h2 className="font-bold">Today</h2><p className="tabular text-sm text-slate-500">{fmt(total)} kcal burned</p></div>
        <ul className="mt-3 space-y-2">
          {list.map((w) => {
            const a = ACTIVITIES.find((x) => x.id === w.type) || { emoji: '🏅', label: w.type };
            return (
              <li key={w.id} className="card flex items-center justify-between py-4">
                <span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f3ee] text-xl">{a.emoji}</span><span><span className="block font-bold">{a.label}</span><span className="text-sm text-slate-500">{w.minutes} min</span></span></span>
                <span className="flex items-center gap-2"><span className="tabular font-bold">{fmt(w.kcal)} kcal</span><button type="button" onClick={() => remove(w.id)} className="rounded-full p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label={'Remove ' + a.label}><Trash2 size={16} /></button></span>
              </li>
            );
          })}
          {!list.length && <li className="rounded-[28px] border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No workouts yet today. A 30-minute walk counts!</li>}
        </ul>
      </section>
    </div>
  );
}
