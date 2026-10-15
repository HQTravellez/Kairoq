import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle, Empty } from '../../components/AppShell.jsx';
import { money, niceDate, STATUS } from '../../lib/format.js';

export default function Approvals() {
  const { data, act } = useWorkspace();
  const [notes, setNotes] = useState({});
  const cur = data.policy.currency;
  const pending = data.approvals.filter((a) => a.status === 'pending'), done = data.approvals.filter((a) => a.status !== 'pending');
  return (
    <>
      <PageTitle title="Approvals" text={pending.length ? pending.length + ' trip' + (pending.length === 1 ? '' : 's') + ' waiting for a decision' : 'Nothing is waiting for you.'} />
      {pending.length === 0 ? <Empty icon={CheckCircle2} title="All caught up" text="New trip requests that need a decision will appear here." /> : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {pending.map((a) => (
            <li key={a.id} className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-display text-lg font-semibold text-slate-900">{a.requester} → {a.destination}</p><p className="text-sm text-slate-500">{niceDate(a.departure_date)} – {niceDate(a.return_date)} · {money(a.estimate, cur)}</p></div>
                <span className={'pill ' + STATUS.pending}>Pending</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{a.purpose}</p>
              {a.note && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{a.note}</p>}
              <label htmlFor={'note-' + a.id} className="mt-4 block text-sm font-medium text-slate-700">Note (optional)</label>
              <input id={'note-' + a.id} value={notes[a.id] || ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} className="input mt-1.5" placeholder="Approved, please book economy" />
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn-primary flex-1" onClick={() => act('decide', { approval_id: a.id, decision: 'approved', note: notes[a.id] }, 'Trip approved')}>Approve</button>
                <button type="button" className="btn-ghost flex-1" onClick={() => act('decide', { approval_id: a.id, decision: 'rejected', note: notes[a.id] }, 'Trip rejected')}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-slate-900">History</h2>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Trip</th><th className="px-5 py-3">Estimate</th><th className="px-5 py-3">Decision</th><th className="px-5 py-3">Note</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {done.map((a) => <tr key={a.id}><td className="px-5 py-3 font-medium text-slate-800">{a.requester} → {a.destination}</td><td className="px-5 py-3">{money(a.estimate, cur)}</td><td className="px-5 py-3"><span className={'pill capitalize ' + STATUS[a.status]}>{a.status}</span></td><td className="px-5 py-3 text-slate-500">{a.note || '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
