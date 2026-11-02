import { useState } from 'react';
import { Bot, Play, Copy, Mail } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { toast } from './ui/toaster.jsx';
import { ago, db, invoke } from '../lib/crm.js';

export default function AgentPage({ runs, drafts }) {
  const [busy, setBusy] = useState(false);
  async function runNow() {
    setBusy(true);
    try { const r = await invoke('morning-run', {}); toast.success(r.run.summary.slice(0, 120)); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function copy(d) {
    const text = 'Subject: ' + d.subject + '\n\n' + d.body;
    try { await navigator.clipboard.writeText(text); toast.success('Copied'); } catch { toast.error('Copy did not work in this browser'); }
  }
  const waiting = (drafts || []).filter((d) => d.status === 'draft');
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Agent</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">Every morning at 8:00 the agent adds follow-up tasks for deals that have gone quiet and for new leads nobody has called. It writes drafts but never sends, charges or deletes anything.</p>
        </div>
        <Button onClick={runNow} disabled={busy}><Play size={16} className="mr-1" /> {busy ? 'Running…' : 'Run now'}</Button>
      </div>
      <section>
        <h2 className="font-semibold">Drafts waiting for you <span className="font-normal text-muted-foreground">({waiting.length})</span></h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {waiting.map((d) => (
            <li key={d.id} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">To {d.contact_name}{d.to ? ' · ' + d.to : ''}</p>
              <p className="mt-1 font-medium">{d.subject}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{d.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(d)}><Copy size={14} className="mr-1" /> Copy</Button>
                {d.to && <Button size="sm" variant="outline" asChild><a href={'mailto:' + d.to + '?subject=' + encodeURIComponent(d.subject) + '&body=' + encodeURIComponent(d.body)}><Mail size={14} className="mr-1" /> Open in mail</a></Button>}
                <Button size="sm" variant="ghost" onClick={() => db.drafts.update(d.id, { status: 'done' })}>Mark sent</Button>
              </div>
            </li>
          ))}
          {!waiting.length && <li className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground md:col-span-2">No drafts. Ask Copilot to "draft a follow-up to Maya about the quote".</li>}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Run log</h2>
        <ol className="mt-3 space-y-4">
          {(runs || []).map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot size={14} aria-hidden="true" /> {r.kind === 'scheduled' ? 'Morning run' : 'Run by hand'} · {ago(r.at)} · {new Date(r.at).toLocaleString()}</div>
              <p className="mt-2 text-sm">{r.summary}</p>
              {(r.actions || []).length > 0 && <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">{r.actions.map((a, i) => <li key={i}><span>{a.text}</span><span className="block text-xs text-muted-foreground">Why: {a.why}</span></li>)}</ul>}
            </li>
          ))}
          {runs && !runs.length && <li className="text-sm text-muted-foreground">No runs yet. The first one is tomorrow at 8:00, or press Run now.</li>}
        </ol>
      </section>
    </div>
  );
}
