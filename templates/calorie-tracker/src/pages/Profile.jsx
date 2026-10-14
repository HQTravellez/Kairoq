import { auth } from 'kairoq';
import { LogOut, Target, RefreshCw } from 'lucide-react';
import { GOALS, ACTIVITY_LEVELS, fmt } from '../lib/fit.js';

export default function Profile({ profile, user, onEdit }) {
  const goal = GOALS.find((g) => g.id === profile.goal), level = ACTIVITY_LEVELS.find((a) => a.id === profile.activity);
  return (
    <div className="mx-auto max-w-md px-5 pt-6 lg:max-w-2xl lg:pt-10">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#c6f432] text-2xl font-extrabold">{(user.name || user.email)[0].toUpperCase()}</span>
        <div><h1 className="text-2xl font-extrabold tracking-tight">{user.name || 'Your profile'}</h1><p className="text-sm text-slate-500">{user.email}</p></div>
      </div>
      <section className="card mt-6">
        <h2 className="flex items-center gap-2 font-bold"><Target size={18} aria-hidden="true" />Daily targets</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[['Calories', fmt(profile.kcal_target) + ' kcal'], ['Protein', profile.protein_g + ' g'], ['Carbs', profile.carbs_g + ' g'], ['Fat', profile.fat_g + ' g'], ['Water', fmt(profile.water_ml) + ' ml'], ['Goal', goal ? goal.label : profile.goal]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-[#f2f3ee] px-4 py-3"><dt className="text-xs font-semibold text-slate-500">{k}</dt><dd className="tabular mt-0.5 font-extrabold">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-slate-500">{profile.sex === 'male' ? 'Male' : 'Female'}, {profile.age} years, {profile.height_cm} cm, {profile.weight_kg} kg · {level ? level.label.toLowerCase() : ''}</p>
        <button type="button" onClick={onEdit} className="btn-soft mt-4 w-full"><RefreshCw size={16} aria-hidden="true" />Recalculate my plan</button>
      </section>
      <button type="button" onClick={() => auth.signOut()} className="btn-soft mt-4 w-full text-red-600"><LogOut size={16} aria-hidden="true" />Sign out</button>
      <p className="mt-6 text-center text-xs text-slate-400">Calorie targets use the Mifflin-St Jeor formula. They are estimates, not medical advice.</p>
    </div>
  );
}
