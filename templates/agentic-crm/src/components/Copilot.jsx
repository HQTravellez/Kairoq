import { useEffect, useRef, useState } from 'react';
import { ai } from 'kairoq';
import { invoke } from '../lib/crm.js';
import { Sparkles, Check, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet.jsx';
import { Button } from './ui/button.jsx';
import { Textarea } from './ui/textarea.jsx';
import { toast } from './ui/toaster.jsx';

const SYSTEM = 'You are Copilot inside Relay, a small team CRM. Use the tools to look up real contacts, deals and tasks before answering; never invent names, numbers or dates. Answer in short plain sentences. To add a task, move a deal or draft an email, call the tool: the user confirms it before it happens. Today is ' + new Date().toDateString() + '.';
const IDEAS = ['Who should I follow up with today?', 'Which deals have gone quiet?', 'Summarise everything about Maya Chen', 'Draft a follow-up to Daniel about the clinic proposal'];

export default function Copilot({ open, onOpenChange }) {
  const [chat, setChat] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [chat, busy]);
  async function ask(text) {
    const q = String(text || '').trim();
    if (!q || busy) return;
    const history = [...chat.filter((m) => m.role !== 'action').map(({ role, content }) => ({ role, content })), { role: 'user', content: q }];
    setChat((c) => [...c, { role: 'user', content: q }]); setBusy(true); setError('');
    try {
      const r = await ai.chat({ system: SYSTEM, messages: history, tools: true });
      setChat((c) => [...c, { role: 'assistant', content: r.text || '' }, ...(r.action ? [{ role: 'action', action: r.action, state: 'waiting' }] : [])]);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function decide(i, yes) {
    const a = chat[i].action;
    setChat((c) => c.map((m, j) => (j === i ? { ...m, state: yes ? 'running' : 'skipped' } : m)));
    if (!yes) return;
    try { await invoke(a.tool, a.args); setChat((c) => c.map((m, j) => (j === i ? { ...m, state: 'done' } : m))); toast.success('Done: ' + a.summary); }
    catch (e) { setChat((c) => c.map((m, j) => (j === i ? { ...m, state: 'waiting' } : m))); toast.error(e.message); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetTitle className="flex items-center gap-2"><Sparkles size={18} aria-hidden="true" /> Copilot</SheetTitle>
        <SheetDescription>Ask about your contacts, deals and tasks. Anything that changes data waits for your OK.</SheetDescription>
        <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1" aria-live="polite">
          {!chat.length && <div className="grid gap-2">{IDEAS.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">{q}</button>)}</div>}
          {chat.map((m, i) => m.role === 'action' ? (
            <div key={i} className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">{m.action.summary}</p>
              {m.state === 'waiting' && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => decide(i, true)}><Check size={14} className="mr-1" /> Approve</Button><Button size="sm" variant="ghost" onClick={() => decide(i, false)}><X size={14} className="mr-1" /> Skip</Button></div>}
              {m.state !== 'waiting' && <p className="mt-1 text-xs text-muted-foreground">{{ running: 'Working…', done: 'Done', skipped: 'Skipped' }[m.state]}</p>}
            </div>
          ) : (
            <p key={i} className={'whitespace-pre-line rounded-md px-3 py-2 text-sm ' + (m.role === 'user' ? 'ml-8 bg-primary text-primary-foreground' : 'mr-8 bg-muted')}>{m.content}</p>
          ))}
          {busy && <p className="mr-8 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Looking at your CRM…</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const f = e.target; ask(f.q.value); f.reset(); }} className="flex gap-2">
          <Textarea name="q" rows={2} placeholder="Ask Copilot" aria-label="Ask Copilot" className="min-h-0 flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} />
          <Button disabled={busy} className="self-end">Ask</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
