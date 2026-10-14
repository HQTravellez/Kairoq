import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { api, targets, GOALS, ACTIVITY_LEVELS, fmt } from '../lib/fit.js';
import { Brand } from '../components/Shell.jsx';

export default function Onboarding({ initial, onDone }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState(initial || { goal: 'lose', sex: 'female', age: 32, height_cm: 168, weight_kg: 70, activity: 'light' });
  const set = (k, v) => setP({ ...p, [k]: v });
  const t = targets({ ...p, age: +p.age, height_cm: +p.height_cm, weight_kg: +p.weight_kg });
  async function save() {
    try { await api('profile.save', { profile: { ...p, age: +p.age, height_cm: +p.height_cm, weight_kg: +p.weight_kg, ...t } }); onDone(); }
    catch (e) { toast.error(e.message); }
  }
  const steps = [
    { title: 'What is your goal?', body: (
      <div className="space-y-3">{GOALS.map((g) => (
        <button key={g.id} type="button" onClick={() => { set('goal', g.id); setStep(1); }} className={'flex w-full items-center gap-4 rounded-3xl p-5 text-left ring-2 transition ' + (p.goal === g.id ? 'bg-white ring-[#0c1222]' : 'bg-white ring-transparent hover:ring-slate-200')}>
          <span className="text-3xl">{g.emoji}</span><span><span className="block text-lg font-bold">{g.label}</span><span className="text-sm text-slate-500">{g.hint}</span></span>
        </button>))}</div>) },
    { title: 'About you', body: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5" role="group" aria-label="Sex">
          {['female', 'male'].map((s) => <button key={s} type="button" aria-pressed={p.sex === s} onClick={() => set('sex', s)} className={'rounded-xl py-3 font-semibold capitalize ' + (p.sex === s ? 'bg-[#0c1222] text-white' : 'text-slate-500')}>{s}</button>)}
        </div>
        {[['age', 'Age', 'years'], ['height_cm', 'Height', 'cm'], ['weight_kg', 'Weight', 'kg']].map(([k, label, unit]) => (
          <label key={k} className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 text-sm font-semibold">{label}
            <span className="flex items-center gap-2"><input type="number" inputMode="decimal" value={p[k]} onChange={(e) => set(k, e.target.value)} className="w-24 rounded-xl bg-[#f2f3ee] px-3 py-2 text-right text-lg font-bold outline-none focus:ring-2 focus:ring-[#0c1222]" aria-label={label} /><span className="w-10 text-slate-400">{unit}</span></span>
          </label>))}
        <button type="button" onClick={() => setStep(2)} className="btn w-full">Continue</button>
      </div>) },
    { title: 'How active are you?', body: (
      <div className="space-y-3">{ACTIVITY_LEVELS.map((a) => (
        <button key={a.id} type="button" onClick={() => { set('activity', a.id); setStep(3); }} className={'w-full rounded-3xl bg-white p-5 text-left ring-2 transition ' + (p.activity === a.id ? 'ring-[#0c1222]' : 'ring-transparent hover:ring-slate-200')}>
          <span className="block text-lg font-bold">{a.label}</span><span className="text-sm text-slate-500">{a.hint}</span>
        </button>))}</div>) },
    { title: 'Your daily plan', body: (
      <div>
        <div className="rounded-[32px] bg-[#0c1222] p-7 text-white">
          <p className="text-sm font-semibold text-white/60">Daily target</p>
          <p className="tabular mt-1 text-6xl font-extrabold tracking-tight">{fmt(t.kcal_target)}<span className="ml-2 text-xl text-[#c6f432]">kcal</span></p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[['Protein', t.protein_g, '#7c6cff'], ['Carbs', t.carbs_g, '#ffb547'], ['Fat', t.fat_g, '#ff6b9a']].map(([k, v, c]) => <div key={k} className="rounded-2xl bg-white/10 py-3"><p className="tabular text-xl font-extrabold" style={{ color: c }}>{v}g</p><p className="text-xs text-white/60">{k}</p></div>)}
          </div>
          <p className="mt-5 text-sm text-white/60">Plus {fmt(t.water_ml)} ml of water a day. You can change all of this later.</p>
        </div>
        <button type="button" onClick={save} className="btn mt-6 w-full">Start tracking</button>
      </div>) }
  ];
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 pb-10 pt-8">
      <div className="flex items-center justify-between">
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)} className="rounded-full bg-white p-2.5" aria-label="Back"><ArrowLeft size={18} /></button> : <Brand />}
        <div className="flex gap-1.5" aria-label={'Step ' + (step + 1) + ' of 4'}>{steps.map((_, i) => <span key={i} className={'h-1.5 rounded-full transition-all ' + (i <= step ? 'w-6 bg-[#0c1222]' : 'w-3 bg-slate-300')} />)}</div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          <h1 className="mb-6 mt-10 text-4xl font-extrabold tracking-tight">{steps[step].title}</h1>
          {steps[step].body}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
