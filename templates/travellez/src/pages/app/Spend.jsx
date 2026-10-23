import { useMemo, useState } from 'react';
import { Wallet, Plus } from 'lucide-react';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle, Empty } from '../../components/AppShell.jsx';
import Modal from '../../components/Modal.jsx';
import { Field } from '../../components/AuthPanel.jsx';
import { money, STATUS, CATEGORIES } from '../../lib/format.js';

const FILTERS = ['all', 'draft', 'submitted', 'paid'];

export default function Spend() {
  const { data, act } = useWorkspace();
  const [filter, setFilter] = useState('all'), [open, setOpen] = useState(false);
  const cur = data.policy.currency;
  const list = useMemo(() => data.expenses.filter((e) => filter === 'all' || e.status === filter), [data.expenses, filter]);
  const sums = FILTERS.slice(1).map((s) => [s, data.expenses.filter((e) => e.status === s).reduce((n, e) => n + e.amount, 0)]);
  return (
    <>
      <PageTitle title="Spend" text="Expenses move from draft to submitted to paid."><button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Add expense</button></PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        {sums.map(([s, v]) => <div key={s} className="card p-5"><p className="text-sm capitalize text-slate-500">{s}</p><p className="mt-1 font-display text-2xl font-semibold text-slate-900">{money(v, cur)}</p></div>)}
      </div>
      <div className="mt-6 mb-4 flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-slate-200 sm:inline-flex" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={'whitespace-nowrap rounded-full px-3 py-1.5 text-sm capitalize ' + (filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>{f}</button>)}
      </div>
      {list.length === 0 ? <Empty icon={Wallet} title={data.expenses.length ? 'No expenses with this status' : 'No expenses yet'} text="Add flights, hotels and other costs to an approved or booked trip." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Expense</th><th className="px-5 py-3">Trip</th><th className="px-5 py-3">Category</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{e.description}</td>
                  <td className="px-5 py-3 text-slate-500">{e.traveler} · {e.destination}</td>
                  <td className="px-5 py-3"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CATEGORIES.find((c) => c.id === e.category).color }} />{CATEGORIES.find((c) => c.id === e.category).label}</span></td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">{money(e.amount, cur)}</td>
                  <td className="px-5 py-3"><span className={'pill capitalize ' + STATUS[e.status]}>{e.status}</span></td>
                  <td className="px-5 py-3 text-right">
                    {e.status === 'draft' && <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => act('submitExpense', { expense_id: e.id }, 'Expense submitted')}>Submit</button>}
                    {e.status === 'submitted' && <button type="button" className="btn-primary px-3 py-1.5" onClick={() => act('payExpense', { expense_id: e.id }, 'Marked as paid')}>Mark paid</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewExpense open={open} onOpenChange={setOpen} />
    </>
  );
}

function NewExpense({ open, onOpenChange }) {
  const { data, act } = useWorkspace();
  const trips = data.trips.filter((t) => ['approved', 'booked'].includes(t.status));
  const empty = { trip_id: '', description: '', amount: '', category: 'flight' };
  const [f, setF] = useState(empty), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await act('addExpense', { ...f, trip_id: Number(f.trip_id), amount: Number(f.amount) }, 'Expense added as a draft');
    setBusy(false); if (r) { onOpenChange(false); setF(empty); }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add an expense">
      {trips.length === 0 ? <p className="text-slate-600">Expenses belong to an approved or booked trip. Approve a trip first.</p> : (
        <form onSubmit={submit} className="grid gap-4">
          <Field id="exp-trip" label="Trip"><select id="exp-trip" required value={f.trip_id} onChange={set('trip_id')} className="input"><option value="">Choose…</option>{trips.map((t) => <option key={t.id} value={t.id}>{t.traveler} · {t.origin} → {t.destination}</option>)}</select></Field>
          <Field id="exp-desc" label="Description"><input id="exp-desc" required value={f.description} onChange={set('description')} className="input" placeholder="Return flight" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="exp-amount" label={'Amount (' + data.policy.currency + ')'}><input id="exp-amount" type="number" min="1" step="1" required value={f.amount} onChange={set('amount')} className="input" /></Field>
            <Field id="exp-cat" label="Category"><select id="exp-cat" value={f.category} onChange={set('category')} className="input">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
          </div>
          <button disabled={busy} className="btn-primary py-3">{busy ? 'Saving…' : 'Add expense'}</button>
        </form>
      )}
    </Modal>
  );
}
