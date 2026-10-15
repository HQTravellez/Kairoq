import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plane, Search, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle, Empty } from '../../components/AppShell.jsx';
import Modal from '../../components/Modal.jsx';
import { Field } from '../../components/AuthPanel.jsx';
import { money, niceDate, nights, STATUS } from '../../lib/format.js';

const FILTERS = ['all', 'requested', 'approved', 'booked', 'rejected', 'cancelled'];
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export default function Trips() {
  const { data, act } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(''), [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(params.get('new') === '1');
  useEffect(() => { if (params.get('new') === '1') { setOpen(true); setParams({}, { replace: true }); } }, [params, setParams]);
  const cur = data.policy.currency;
  const list = useMemo(() => data.trips.filter((t) => (filter === 'all' || t.status === filter) && (!q || (t.traveler + ' ' + t.origin + ' ' + t.destination + ' ' + t.purpose).toLowerCase().includes(q.toLowerCase()))), [data.trips, q, filter]);
  return (
    <>
      <PageTitle title="Trips" text="Every request, approval and booking."><button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Request a trip</button></PageTitle>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search trips" placeholder="Search traveler, city or purpose" value={q} onChange={(e) => setQ(e.target.value)} className="input pl-10" /></div>
        <div className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={'whitespace-nowrap rounded-full px-3 py-1.5 text-sm capitalize ' + (filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>{f}</button>)}
        </div>
      </div>
      {list.length === 0 ? <Empty icon={Plane} title={data.trips.length ? 'No trips match' : 'No trips yet'} text={data.trips.length ? 'Try another search or filter.' : 'Request the first trip for one of your travelers.'} /> : (
        <ul className="space-y-3">
          {list.map((t) => (
            <li key={t.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-slate-900">{t.origin} → {t.destination}</p>
                  <p className="text-sm text-slate-500">{t.traveler} · {niceDate(t.departure_date)} – {niceDate(t.return_date)} · {nights(t.departure_date, t.return_date)} night{nights(t.departure_date, t.return_date) === 1 ? '' : 's'}</p>
                  <p className="mt-2 text-sm text-slate-700">{t.purpose}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={'pill capitalize ' + STATUS[t.status]}>{t.status}</span>
                  {t.over_policy ? <span className="pill bg-amber-50 text-amber-700"><AlertTriangle size={12} />Outside policy</span> : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                <p className="text-slate-600">Estimate <b className="text-slate-900">{money(t.estimate, cur)}</b> · Spent <b className="text-slate-900">{money(t.spent, cur)}</b></p>
                <div className="flex gap-2">
                  {t.status === 'approved' && <button type="button" className="btn-primary px-4 py-2" onClick={() => act('book', { trip_id: t.id }, 'Trip booked')}>Mark as booked</button>}
                  {['requested', 'approved'].includes(t.status) && <button type="button" className="btn-ghost px-4 py-2" onClick={() => act('cancelTrip', { trip_id: t.id }, 'Trip cancelled')}>Cancel trip</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NewTrip open={open} onOpenChange={setOpen} />
    </>
  );
}

function NewTrip({ open, onOpenChange }) {
  const { data, act } = useWorkspace();
  const active = data.travelers.filter((t) => t.status === 'active');
  const empty = { traveler_id: '', origin: '', destination: '', departure_date: inDays(14), return_date: inDays(16), purpose: '', estimate: '' };
  const [f, setF] = useState(empty), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await act('createTrip', { ...f, traveler_id: Number(f.traveler_id), estimate: Number(f.estimate) });
    setBusy(false);
    if (r) {
      onOpenChange(false); setF(empty);
      toast.success(r.status === 'approved' ? 'Trip approved automatically (within policy)' : r.over_policy.length ? 'Trip sent for approval (outside policy: ' + r.over_policy.join(', ') + ')' : 'Trip sent for approval');
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Request a trip">
      {active.length === 0 ? <p className="text-slate-600">Add an active traveler first, on the Travelers page.</p> : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field id="trip-traveler" label="Traveler"><select id="trip-traveler" required value={f.traveler_id} onChange={set('traveler_id')} className="input"><option value="">Choose…</option>{active.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.department}</option>)}</select></Field></div>
          <Field id="trip-origin" label="From"><input id="trip-origin" required value={f.origin} onChange={set('origin')} className="input" placeholder="London" /></Field>
          <Field id="trip-destination" label="To"><input id="trip-destination" required value={f.destination} onChange={set('destination')} className="input" placeholder="Lisbon" /></Field>
          <Field id="trip-departure" label="Departure"><input id="trip-departure" type="date" required value={f.departure_date} onChange={set('departure_date')} className="input" /></Field>
          <Field id="trip-return" label="Return"><input id="trip-return" type="date" required min={f.departure_date} value={f.return_date} onChange={set('return_date')} className="input" /></Field>
          <div className="sm:col-span-2"><Field id="trip-purpose" label="Business purpose"><input id="trip-purpose" required value={f.purpose} onChange={set('purpose')} className="input" placeholder="Client workshop" /></Field></div>
          <Field id="trip-estimate" label={'Estimated cost (' + data.policy.currency + ')'} hint={'Trip cap: ' + money(data.policy.trip_cap, data.policy.currency)}><input id="trip-estimate" type="number" min="0" step="1" required value={f.estimate} onChange={set('estimate')} className="input" /></Field>
          <div className="flex items-end"><button disabled={busy} className="btn-primary w-full py-3">{busy ? 'Sending…' : 'Send for approval'}</button></div>
        </form>
      )}
    </Modal>
  );
}
