import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle } from '../../components/AppShell.jsx';
import { Field } from '../../components/AuthPanel.jsx';
import { money } from '../../lib/format.js';

export default function Controls() {
  const { data, act } = useWorkspace();
  const [f, setF] = useState({ ...data.policy });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) { e.preventDefault(); setBusy(true); await act('savePolicy', f, 'Policy saved'); setBusy(false); }
  return (
    <>
      <PageTitle title="Controls" text="Your travel policy. New trip requests are checked against it instantly." />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} className="card grid gap-5 p-6 sm:grid-cols-2">
          <Field id="pol-currency" label="Currency"><select id="pol-currency" value={f.currency} onChange={set('currency')} className="input">{['CAD', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field id="pol-cap" label="Trip cap" hint="Trips estimated above this need a manager."><input id="pol-cap" type="number" min="0" value={f.trip_cap} onChange={set('trip_cap')} className="input" /></Field>
          <Field id="pol-hotel" label="Hotel night cap"><input id="pol-hotel" type="number" min="0" value={f.hotel_night_cap} onChange={set('hotel_night_cap')} className="input" /></Field>
          <Field id="pol-advance" label="Book at least (days ahead)"><input id="pol-advance" type="number" min="0" value={f.advance_days} onChange={set('advance_days')} className="input" /></Field>
          <div className="sm:col-span-2"><Field id="pol-auto" label="Approve automatically up to" hint="In-policy trips at or below this amount skip the manager. 0 means every trip needs a manager."><input id="pol-auto" type="number" min="0" value={f.require_approval_above} onChange={set('require_approval_above')} className="input" /></Field></div>
          <div className="sm:col-span-2"><button disabled={busy} className="btn-primary py-3">{busy ? 'Saving…' : 'Save policy'}</button></div>
        </form>
        <aside className="bg-[#14161a] rounded-3xl p-7 text-white">
          <ShieldCheck className="text-[#ff8a94]" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Your policy in plain words</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            <li>Trips up to {money(f.trip_cap, f.currency)} are within the cap.</li>
            <li>Hotels up to {money(f.hotel_night_cap, f.currency)} a night.</li>
            <li>Book at least {f.advance_days} day{Number(f.advance_days) === 1 ? '' : 's'} before departure.</li>
            <li>{Number(f.require_approval_above) > 0 ? 'In-policy trips up to ' + money(f.require_approval_above, f.currency) + ' are approved automatically.' : 'Every trip needs a manager\'s approval.'}</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
