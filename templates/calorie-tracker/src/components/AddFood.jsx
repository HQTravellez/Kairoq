import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Minus, Plus, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, MEALS, round, fmt } from '../lib/fit.js';

// Bottom sheet (phone) / dialog (desktop) to add food: search, quick add, or describe with AI.
export default function AddFood({ open, onOpenChange, day, meal: initialMeal, onAdded }) {
  const [tab, setTab] = useState('search');
  const [meal, setMeal] = useState(initialMeal || 'breakfast');
  const [q, setQ] = useState('');
  const [foods, setFoods] = useState([]);
  const [picked, setPicked] = useState(null);
  const [servings, setServings] = useState(1);
  const [quick, setQuick] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [aiText, setAiText] = useState('');
  const [aiItems, setAiItems] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setMeal(initialMeal || 'breakfast'); setPicked(null); setServings(1); setQ(''); setAiItems(null); } }, [open, initialMeal]);
  useEffect(() => {
    if (!open || tab !== 'search') return;
    const t = setTimeout(() => api('foods', { q }).then((r) => setFoods(r.foods)).catch((e) => toast.error(e.message)), 180);
    return () => clearTimeout(t);
  }, [q, open, tab]);

  async function add(body, label) {
    setBusy(true);
    try { await api('food.add', { day, meal, ...body }); toast.success(label + ' added to ' + MEALS.find((m) => m.id === meal).label.toLowerCase()); onAdded(); onOpenChange(false); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function estimate(e) {
    e.preventDefault(); setBusy(true);
    try { setAiItems((await api('estimate', { text: aiText })).items); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }
  async function addAll() {
    setBusy(true);
    try { for (const i of aiItems) await api('food.add', { day, meal, ...i }); toast.success(aiItems.length + ' items added'); onAdded(); onOpenChange(false); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }
  const preview = useMemo(() => picked && { kcal: picked.kcal * servings, protein: picked.protein * servings, carbs: picked.carbs * servings, fat: picked.fat * servings }, [picked, servings]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#0c1222]/40 backdrop-blur-sm" />
        <Dialog.Content className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-[32px] bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px]" aria-describedby={undefined}>
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-center justify-between px-6 pb-2 pt-4">
            <Dialog.Title className="text-xl font-extrabold">Add food</Dialog.Title>
            <Dialog.Close className="rounded-full p-2 hover:bg-slate-100" aria-label="Close"><X size={20} /></Dialog.Close>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-6 pb-3" role="group" aria-label="Meal">
            {MEALS.map((m) => <button key={m.id} type="button" onClick={() => setMeal(m.id)} aria-pressed={meal === m.id} className={'chip shrink-0 px-4 py-2 text-sm ' + (meal === m.id ? 'bg-[#0c1222] text-white' : 'bg-[#f2f3ee] text-slate-600')}>{m.emoji} {m.label}</button>)}
          </div>
          <div className="mx-6 grid grid-cols-3 rounded-2xl bg-[#f2f3ee] p-1 text-sm font-semibold" role="tablist">
            {[['search', 'Search'], ['quick', 'Quick add'], ['ai', 'Describe']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={'rounded-xl py-2 transition ' + (tab === id ? 'bg-white shadow-sm' : 'text-slate-500')}>{label}</button>)}
          </div>

          {tab === 'search' && !picked && (
            <div className="flex min-h-0 flex-1 flex-col px-6 pt-4">
              <label className="relative block"><span className="sr-only">Search foods</span>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, e.g. oatmeal" className="field pl-11" />
              </label>
              <ul className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto pb-4">
                {foods.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => setPicked(f)} className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#f2f3ee]">
                      <span><span className="block font-semibold">{f.name}</span><span className="text-sm text-slate-500">{f.serving}</span></span>
                      <span className="tabular shrink-0 font-bold">{fmt(f.kcal)} <span className="text-xs font-semibold text-slate-400">kcal</span></span>
                    </button>
                  </li>
                ))}
                {!foods.length && <li className="py-10 text-center text-sm text-slate-500">No match. Try “Quick add”.</li>}
              </ul>
            </div>
          )}

          {tab === 'search' && picked && (
            <div className="px-6 pb-6 pt-5">
              <button type="button" onClick={() => setPicked(null)} className="text-sm font-semibold text-slate-500">← Back to results</button>
              <h3 className="mt-3 text-2xl font-extrabold">{picked.name}</h3>
              <p className="text-slate-500">{picked.serving} per serving</p>
              <div className="mt-6 flex items-center justify-between rounded-3xl bg-[#f2f3ee] p-3">
                <button type="button" aria-label="Fewer servings" onClick={() => setServings(Math.max(0.25, servings - 0.25))} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"><Minus size={18} /></button>
                <div className="text-center"><p className="tabular text-3xl font-extrabold">{servings}</p><p className="text-xs font-semibold text-slate-500">serving{servings === 1 ? '' : 's'}</p></div>
                <button type="button" aria-label="More servings" onClick={() => setServings(servings + 0.25)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"><Plus size={18} /></button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[['kcal', preview.kcal, '#0c1222'], ['Protein', preview.protein, 'var(--protein)'], ['Carbs', preview.carbs, 'var(--carbs)'], ['Fat', preview.fat, 'var(--fat)']].map(([k, v, c]) => (
                  <div key={k} className="rounded-2xl bg-[#f2f3ee] py-3"><p className="tabular text-lg font-extrabold" style={{ color: c }}>{round(v)}{k === 'kcal' ? '' : 'g'}</p><p className="text-xs font-semibold text-slate-500">{k}</p></div>
                ))}
              </div>
              <button type="button" disabled={busy} onClick={() => add({ food_id: picked.id, servings }, picked.name)} className="btn mt-6 w-full">{busy && <Loader2 className="animate-spin" size={18} />}Add {fmt(preview.kcal)} kcal</button>
            </div>
          )}

          {tab === 'quick' && (
            <form className="grid grid-cols-2 gap-3 px-6 pb-6 pt-5" onSubmit={(e) => { e.preventDefault(); add({ ...quick }, quick.name || 'Food'); }}>
              <label className="col-span-2 text-sm font-semibold">Name<input required value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className="field mt-1.5" placeholder="Homemade lasagne" /></label>
              <label className="col-span-2 text-sm font-semibold">Calories<input required type="number" inputMode="numeric" min="0" value={quick.kcal} onChange={(e) => setQuick({ ...quick, kcal: e.target.value })} className="field mt-1.5" placeholder="kcal" /></label>
              {['protein', 'carbs', 'fat'].map((k) => <label key={k} className="text-sm font-semibold capitalize">{k} (g)<input type="number" inputMode="decimal" min="0" value={quick[k]} onChange={(e) => setQuick({ ...quick, [k]: e.target.value })} className="field mt-1.5" /></label>)}
              <button disabled={busy} className="btn col-span-2 mt-2">Add</button>
            </form>
          )}

          {tab === 'ai' && (
            <div className="px-6 pb-6 pt-5">
              {!aiItems ? (
                <form onSubmit={estimate}>
                  <label className="text-sm font-semibold">What did you eat?<textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={3} className="field mt-1.5" placeholder="Two slices of sourdough with avocado and a poached egg, and a flat white" /></label>
                  <button disabled={busy || !aiText.trim()} className="btn mt-4 w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} Estimate with AI</button>
                  <p className="mt-3 text-center text-xs text-slate-400">AI estimates can be off. Check before adding.</p>
                </form>
              ) : (
                <div>
                  <ul className="space-y-2">{aiItems.map((i, n) => <li key={n} className="flex justify-between rounded-2xl bg-[#f2f3ee] px-4 py-3"><span className="font-semibold">{i.name}</span><span className="tabular font-bold">{i.kcal} kcal</span></li>)}</ul>
                  <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setAiItems(null)} className="btn-soft">Edit</button><button type="button" disabled={busy} onClick={addAll} className="btn">Add all</button></div>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
