import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DataTable } from './ui/data-table.jsx';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Textarea } from './ui/textarea.jsx';
import { Label } from './ui/label.jsx';
import { Badge } from './ui/badge.jsx';
import { toast } from './ui/toaster.jsx';
import { money, ago, db, log } from '../lib/crm.js';

const STATUS = ['New', 'Qualified', 'Customer', 'Inactive'];

export default function Contacts({ contacts, deals, activity }) {
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  if (!contacts) return null;
  const c = open && contacts.find((x) => x.id === open);
  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const made = await db.contacts.create({ ...f, status: 'New' });
    await log('Added ' + made.name + ' as a new lead', { contact_id: made.id });
    e.target.reset(); setAdding(false); toast.success(made.name + ' added');
  }
  async function note(e) {
    e.preventDefault();
    const text = new FormData(e.target).get('note');
    if (!String(text).trim()) return;
    await log(String(text).trim(), { contact_id: c.id });
    e.target.reset();
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-3xl font-semibold tracking-tight">Contacts</h1><p className="mt-1 text-muted-foreground">{contacts.length} people</p></div>
        <Button onClick={() => setAdding(!adding)}><Plus size={16} className="mr-1" /> New contact</Button>
      </div>
      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
          <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" required name="name" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-company">Company</Label><Input id="c-company" name="company" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" name="email" /></div>
          <div className="flex items-end"><Button className="w-full">Add contact</Button></div>
        </form>
      )}
      <DataTable data={contacts} searchPlaceholder="Search contacts" filters={[{ key: 'status', label: 'Status', options: STATUS }]} onRowClick={(r) => setOpen(r.id)}
        columns={[
          { key: 'name', header: 'Name', sortable: true, cell: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'company', header: 'Company', sortable: true },
          { key: 'email', header: 'Email' },
          { key: 'status', header: 'Status', cell: (r) => <Badge variant={r.status === 'Customer' ? 'default' : 'secondary'}>{r.status}</Badge> }
        ]} />
      <Sheet open={!!c} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {c && (<>
            <SheetTitle className="text-xl">{c.name}</SheetTitle>
            <SheetDescription>{c.company}{c.email ? ' · ' + c.email : ''}</SheetDescription>
            <label className="text-sm" htmlFor="c-status">Status</label>
            <select id="c-status" value={c.status} onChange={(e) => db.contacts.update(c.id, { status: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm">{STATUS.map((s) => <option key={s}>{s}</option>)}</select>
            {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
            <section><h3 className="text-sm font-semibold">Deals</h3>
              <ul className="mt-2 space-y-1 text-sm">{(deals || []).filter((d) => d.contact_id === c.id).map((d) => <li key={d.id} className="flex justify-between"><span>{d.title} · {d.stage}</span><span className="tabular-nums">{money(d.value)}</span></li>)}</ul>
            </section>
            <section><h3 className="text-sm font-semibold">Timeline</h3>
              <form onSubmit={note} className="mt-2 space-y-2"><Textarea name="note" rows={2} placeholder="Add a note from a call or meeting" aria-label="Note" /><Button size="sm" variant="outline">Save note</Button></form>
              <ul className="mt-3 space-y-3">{(activity || []).filter((a) => a.contact_id === c.id).map((a) => <li key={a.id} className="text-sm"><p>{a.text}</p><p className="text-xs text-muted-foreground">{a.by === 'you' ? 'You' : a.by === 'agent' ? 'Agent' : 'Copilot'} · {ago(a.at)}</p></li>)}</ul>
            </section>
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
