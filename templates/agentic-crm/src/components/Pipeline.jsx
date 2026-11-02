import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Kanban } from './ui/kanban.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { toast } from './ui/toaster.jsx';
import { STAGES, money, ago, db } from '../lib/crm.js';

export default function Pipeline({ deals, contacts }) {
  const [adding, setAdding] = useState(false);
  if (!deals) return null;
  async function move(id, stage) {
    const d = deals.find((x) => x.id === id);
    if (!d || d.stage === stage) return;
    const at = new Date().toISOString();
    await db.deals.update(id, { stage, last_activity_at: at });
    await db.activity.create({ at, type: 'stage', by: 'you', text: 'Moved ' + d.title + ' from ' + d.stage + ' to ' + stage, deal_id: id, contact_id: d.contact_id || null });
    if (stage === 'Won') toast.success(d.title + ' won: ' + money(d.value));
  }
  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const c = contacts?.find((x) => x.id === f.contact_id);
    await db.deals.create({ title: f.title, value: Number(f.value || 0), stage: 'Lead', contact_id: c?.id || null, company: c?.company || '', last_activity_at: new Date().toISOString() });
    e.target.reset(); setAdding(false); toast.success('Deal added');
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-3xl font-semibold tracking-tight">Pipeline</h1><p className="mt-1 text-muted-foreground">Drag a deal to change its stage.</p></div>
        <Button onClick={() => setAdding(!adding)}><Plus size={16} className="mr-1" /> New deal</Button>
      </div>
      {adding && (
        <form onSubmit={add} className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
          <Input required name="title" placeholder="What is the deal?" aria-label="Deal name" className="min-w-[200px] flex-1" />
          <Input name="value" type="number" min="0" placeholder="Value ($)" aria-label="Value" className="w-36" />
          <select name="contact_id" aria-label="Contact" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">No contact</option>{(contacts || []).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.company}</option>)}</select>
          <Button>Add</Button>
        </form>
      )}
      <Kanban columns={STAGES.map((s) => ({ id: s, title: s }))} items={deals.map((d) => ({ ...d, column: d.stage }))} onMove={move}
        columnTotal={(items) => money(items.reduce((n, d) => n + Number(d.value || 0), 0))}
        renderCard={(d) => (
          <div className="space-y-1">
            <p className="font-medium leading-snug">{d.title}</p>
            <p className="text-sm text-muted-foreground">{d.company}</p>
            <div className="flex items-center justify-between pt-1 text-xs"><span className="font-medium tabular-nums">{money(d.value)}</span><span className="text-muted-foreground">{ago(d.last_activity_at || d._updated_at)}</span></div>
          </div>
        )} />
    </div>
  );
}
