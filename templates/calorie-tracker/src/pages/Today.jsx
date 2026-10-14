import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Ring from '../components/Ring.jsx';
import MacroBar from '../components/MacroBar.jsx';
import AddFood from '../components/AddFood.jsx';
import { api, MEALS, totals, todayISO, shiftDay, dayLabel, fmt, round } from '../lib/fit.js';

export default function Today({ profile, user }) {
  const [day, setDay] = useState(todayISO());
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null);
  const load = useCallback(() => api('day', { day }).then(setData).catch((e) => toast.error(e.message)), [day]);
  useEffect(() => { setData(null); load(); }, [load]);
  const t = totals(data ? data.entries : []);
  const burned = data ? data.workouts.reduce((n, w) => n + w.kcal, 0) : 0;
  const target = profile.kcal_target + burned, left = target - t.kcal;
  const glasses = Math.round(profile.water_ml / 250), drunk = data ? Math.round(data.water_ml / 250) : 0;
  async function water(n) {
    const ml = Math.max(0, n) * 250;
    setData({ ...data, water_ml: ml });
    try { await api('water', { day, ml }); } catch (e) { toast.error(e.message); load(); }
  }
  async function remove(id) { try { await api('food.remove', { id }); load(); } catch (e) { toast.error(e.message); } }
  const hello = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto max-w-md px-5 pt-6 lg:max-w-none lg:pt-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-400">{hello}{user.name ? ', ' + user.name : ''}</p>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" onClick={() => setDay(shiftDay(day, -1))} className="rounded-full p-1.5 hover:bg-white" aria-label="Previous day"><ChevronLeft size={22} /></button>
            <h1 className="min-w-[132px] text-center text-2xl font-extrabold tracking-tight">{dayLabel(day)}</h1>
            <button type="button" disabled={day >= todayISO()} onClick={() => setDay(shiftDay(day, 1))} className="rounded-full p-1.5 hover:bg-white disabled:opacity-30" aria-label="Next day"><ChevronRight size={22} /></button>
          </div>
        </div>
        <button type="button" onClick={() => setSheet('snacks')} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c6f432] shadow-lg shadow-lime-500/20 lg:hidden" aria-label="Add food"><Plus size={24} /></button>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-[32px] bg-[#0c1222] p-6 text-white">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c6f432]/15 blur-3xl" />
            <div className="relative flex items-center justify-between gap-4">
              <Ring value={t.kcal} max={target} size={176} stroke={16}>
                <p className="tabular text-4xl font-extrabold tracking-tight">{fmt(Math.abs(left))}</p>
                <p className="text-xs font-semibold text-white/60">{left >= 0 ? 'kcal left' : 'kcal over'}</p>
              </Ring>
              <dl className="flex-1 space-y-4">
                <div><dt className="text-xs font-semibold text-white/50">Eaten</dt><dd className="tabular text-2xl font-extrabold">{fmt(t.kcal)}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs font-semibold text-white/50"><Flame size={13} className="text-[#ffb547]" aria-hidden="true" />Burned</dt><dd className="tabular text-2xl font-extrabold">{fmt(burned)}</dd></div>
                <div><dt className="text-xs font-semibold text-white/50">Goal</dt><dd className="tabular text-2xl font-extrabold">{fmt(profile.kcal_target)}</dd></div>
              </dl>
            </div>
          </section>

          <section className="card space-y-4" aria-label="Macros">
            <MacroBar label="Protein" value={t.protein} target={profile.protein_g} color="var(--protein)" />
            <MacroBar label="Carbs" value={t.carbs} target={profile.carbs_g} color="var(--carbs)" />
            <MacroBar label="Fat" value={t.fat} target={profile.fat_g} color="var(--fat)" />
          </section>

          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Water</h2>
              <p className="tabular text-sm text-slate-500"><span className="font-bold text-[#0c1222]">{fmt(drunk * 250)}</span> / {fmt(profile.water_ml)} ml</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: Math.max(glasses, drunk) }, (_, i) => (
                <motion.button key={i} type="button" whileTap={{ scale: 0.85 }} onClick={() => water(i < drunk ? i : i + 1)} aria-label={'Glass ' + (i + 1) + (i < drunk ? ', drunk' : '')}
                  className={'flex h-11 w-9 items-end justify-center overflow-hidden rounded-b-xl rounded-t-md border-2 transition ' + (i < drunk ? 'border-[#38bdf8] bg-sky-50' : 'border-slate-200 bg-white')}>
                  <span className={'w-full rounded-b-lg bg-[#38bdf8] transition-all ' + (i < drunk ? 'h-[80%]' : 'h-0')} />
                </motion.button>
              ))}
            </div>
          </section>
        </div>

        <section className="space-y-3" aria-label="Meals">
          {MEALS.map((m) => {
            const items = data ? data.entries.filter((e) => e.meal === m.id) : [];
            const kcal = items.reduce((n, e) => n + e.kcal, 0);
            return (
              <div key={m.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f3ee] text-xl">{m.emoji}</span>
                    <div><h3 className="font-bold">{m.label}</h3><p className="tabular text-sm text-slate-500">{kcal ? fmt(kcal) + ' kcal' : 'Suggested ' + fmt(profile.kcal_target * m.share)}</p></div>
                  </div>
                  <button type="button" onClick={() => setSheet(m.id)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0c1222] text-white transition active:scale-90" aria-label={'Add to ' + m.label}><Plus size={20} /></button>
                </div>
                {items.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                    {items.map((e) => (
                      <li key={e.id} className="group flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0"><p className="truncate font-semibold">{e.name}</p><p className="tabular text-xs text-slate-500">{e.servings !== 1 ? e.servings + ' × · ' : ''}P {round(e.protein)} · C {round(e.carbs)} · F {round(e.fat)}</p></div>
                        <div className="flex items-center gap-2"><span className="tabular font-bold">{fmt(e.kcal)}</span><button type="button" onClick={() => remove(e.id)} className="rounded-full p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label={'Remove ' + e.name}><Trash2 size={16} /></button></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      </div>
      <AddFood open={Boolean(sheet)} onOpenChange={(o) => !o && setSheet(null)} day={day} meal={sheet || 'breakfast'} onAdded={load} />
    </div>
  );
}
