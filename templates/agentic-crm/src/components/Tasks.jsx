import { Plus } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { toast } from './ui/toaster.jsx';
import { today, db } from '../lib/crm.js';

const WHO = { you: 'You', agent: 'Agent', copilot: 'Copilot' };

export default function Tasks({ tasks }) {
  if (!tasks) return null;
  const open = tasks.filter((t) => !t.done).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const done = tasks.filter((t) => t.done).slice(0, 10);
  async function add(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await db.tasks.create({ title: f.title, due: f.due || today(), done: false, by: 'you' });
    e.target.reset(); toast.success('Task added');
  }
  const row = (t) => (
    <li key={t.id} className="flex items-center gap-3 py-3">
      <input type="checkbox" checked={!!t.done} onChange={() => db.tasks.update(t.id, { done: !t.done })} aria-label={'Done: ' + t.title} className="h-4 w-4 accent-[hsl(var(--primary))]" />
      <span className={'min-w-0 flex-1 text-sm ' + (t.done ? 'text-muted-foreground line-through' : '')}>{t.title}</span>
      {t.by !== 'you' && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{WHO[t.by]}</span>}
      <span className={'w-24 text-right text-xs tabular-nums ' + (!t.done && t.due < today() ? 'text-destructive' : 'text-muted-foreground')}>{t.due}</span>
    </li>
  );
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">Tasks</h1><p className="mt-1 text-muted-foreground">{open.length} open</p></div>
      <form onSubmit={add} className="flex flex-wrap gap-2"><Input required name="title" placeholder="Add a task" aria-label="Task" className="min-w-[220px] flex-1" /><Input name="due" type="date" aria-label="Due date" className="w-44" /><Button><Plus size={16} className="mr-1" /> Add</Button></form>
      <ul className="divide-y rounded-lg border bg-card px-4">{open.map(row)}{!open.length && <li className="py-8 text-center text-sm text-muted-foreground">No open tasks.</li>}</ul>
      {done.length > 0 && <section><h2 className="text-sm font-semibold text-muted-foreground">Done recently</h2><ul className="mt-2 divide-y rounded-lg border bg-card px-4">{done.map(row)}</ul></section>}
    </div>
  );
}
