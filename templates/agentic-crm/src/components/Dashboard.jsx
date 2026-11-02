import { Bot, ArrowRight } from 'lucide-react';
import { StatGrid, StatCard } from './ui/stat-card.jsx';
import { Button } from './ui/button.jsx';
import { Skeleton } from './ui/skeleton.jsx';
import { OPEN, money, today, ago } from '../lib/crm.js';

const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);

export default function Dashboard({ deals, tasks, activity, runs, setView, onCopilot }) {
  if (!deals || !tasks) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const open = deals.filter((d) => OPEN.includes(d.stage));
  const due = tasks.filter((t) => !t.done && (t.due || today()) <= today());
  const quiet = open.filter((d) => Date.now() - Date.parse(d.last_activity_at || d._updated_at) > 7 * 86400000);
  const won = deals.filter((d) => d.stage === 'Won');
  const last = (runs || [])[0];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 text-muted-foreground">{due.length ? due.length + ' task' + (due.length === 1 ? '' : 's') + ' due' : 'Nothing due'} · {quiet.length} deal{quiet.length === 1 ? '' : 's'} gone quiet</p>
      </div>
      <StatGrid>
        <StatCard label="Open pipeline" value={money(open.reduce((n, d) => n + Number(d.value || 0), 0))} note={n(open.length, 'deal', 'deals')} />
        <StatCard label="Won" value={money(won.reduce((n, d) => n + Number(d.value || 0), 0))} note={n(won.length, 'deal', 'deals')} />
        <StatCard label="Due today" value={String(due.length)} note={due.length === 1 ? 'task' : 'tasks'} />
        <StatCard label="Quiet 7+ days" value={String(quiet.length)} note={quiet.length === 1 ? 'deal' : 'deals'} />
      </StatGrid>
      <section className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Bot size={18} aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold">Agent briefing</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{last ? last.summary : 'The agent runs every morning at 8:00. It adds follow-up tasks for quiet deals and new leads, and never sends anything without you.'}</p>
              {last && <p className="mt-2 text-xs text-muted-foreground">{last.kind === 'scheduled' ? 'Morning run' : 'Run by hand'} · {ago(last.at)}</p>}
            </div>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => setView('agent')}>Agent log</Button><Button onClick={onCopilot}>Ask Copilot</Button></div>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Due today</h2><button onClick={() => setView('tasks')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">All tasks <ArrowRight size={14} /></button></div>
          <ul className="mt-4 divide-y">
            {due.slice(0, 6).map((t) => <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate">{t.title}</span>{t.by !== 'you' && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t.by === 'agent' ? 'Agent' : 'Copilot'}</span>}</li>)}
            {!due.length && <li className="py-6 text-sm text-muted-foreground">You are clear for today.</li>}
          </ul>
        </section>
        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {(activity || []).slice(0, 7).map((a) => <li key={a.id} className="text-sm"><p>{a.text}</p><p className="text-xs text-muted-foreground">{a.by === 'you' ? 'You' : a.by === 'agent' ? 'Agent' : 'Copilot'} · {ago(a.at)}</p></li>)}
            {activity && !activity.length && <li className="text-sm text-muted-foreground">Activity from you, Copilot and the agent shows up here.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
