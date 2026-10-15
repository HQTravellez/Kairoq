import { useState } from 'react';
import { Users, Plus, Pencil } from 'lucide-react';
import { useWorkspace } from '../../lib/workspace.jsx';
import { PageTitle, Empty } from '../../components/AppShell.jsx';
import Modal from '../../components/Modal.jsx';
import { Field } from '../../components/AuthPanel.jsx';
import { STATUS } from '../../lib/format.js';

export default function Travelers() {
  const { data } = useWorkspace();
  const [edit, setEdit] = useState(null);
  const tripsBy = (id) => data.trips.filter((t) => t.traveler_id === id).length;
  return (
    <>
      <PageTitle title="Travelers" text="The people who travel for your company."><button type="button" className="btn-primary" onClick={() => setEdit({})}><Plus size={16} />Add traveler</button></PageTitle>
      {data.travelers.length === 0 ? <Empty icon={Users} title="No travelers yet" text="Add the first person who travels for work."><button type="button" className="btn-primary mt-6" onClick={() => setEdit({})}><Plus size={16} />Add traveler</button></Empty> : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.travelers.map((t) => (
            <li key={t.id} className="card flex items-center gap-4 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ef3444] font-semibold text-white">{t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{t.name}</p>
                <p className="truncate text-sm text-slate-500">{t.department} · {tripsBy(t.id)} trip{tripsBy(t.id) === 1 ? '' : 's'}</p>
                <span className={'pill mt-1 capitalize ' + STATUS[t.status]}>{t.status}</span>
              </div>
              <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={'Edit ' + t.name} onClick={() => setEdit(t)}><Pencil size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {edit && <TravelerForm traveler={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function TravelerForm({ traveler, onClose }) {
  const { act } = useWorkspace();
  const [f, setF] = useState({ name: traveler.name || '', email: traveler.email || '', department: traveler.department || '', status: traveler.status || 'active' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    const r = await act('saveTraveler', { ...f, id: traveler.id }, traveler.id ? 'Traveler updated' : 'Traveler added');
    setBusy(false); if (r) onClose();
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={traveler.id ? 'Edit traveler' : 'Add a traveler'}>
      <form onSubmit={submit} className="grid gap-4">
        <Field id="tr-name" label="Full name"><input id="tr-name" required value={f.name} onChange={set('name')} className="input" /></Field>
        <Field id="tr-email" label="Work email"><input id="tr-email" type="email" required value={f.email} onChange={set('email')} className="input" /></Field>
        <Field id="tr-dept" label="Department"><input id="tr-dept" value={f.department} onChange={set('department')} className="input" placeholder="Sales" /></Field>
        {traveler.id && <Field id="tr-status" label="Status" hint="Inactive travelers cannot be booked on new trips."><select id="tr-status" value={f.status} onChange={set('status')} className="input"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>}
        <button disabled={busy} className="btn-primary py-3">{busy ? 'Saving…' : traveler.id ? 'Save changes' : 'Add traveler'}</button>
      </form>
    </Modal>
  );
}
