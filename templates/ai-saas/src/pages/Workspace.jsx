import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { ai, collection, usePageMeta } from 'kairoq';
import { refreshCredits } from 'kairoq/saas';
import { PRODUCT, AI } from '../saas.config.js';
import { useSession, useTeam } from '../lib/session.js';

// The product itself: write a proposal from a client's brief with AI, and keep the team's drafts.
// This page is the part to change when this starter becomes a different SaaS.
const drafts = collection('drafts');
const TONES = ['Warm and plain', 'Formal', 'Short and direct'];
const FIELD = 'w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20';

export default function Workspace() {
  usePageMeta({ title: 'Drafts · ' + PRODUCT.name });
  const { user } = useSession();
  const { team } = useTeam(user);
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const canWrite = team && team.role !== 'viewer';

  useEffect(() => {
    if (!team) return;
    setItems(null); setSelected(null);
    drafts.list({ limit: 200 }).then(setItems).catch((e) => { toast.error(e.message); setItems([]); });
    // Colleagues' new drafts appear without a reload.
    return drafts.subscribe(({ type, item }) => setItems((list) => {
      if (!list) return list;
      if (type === 'deleted') return list.filter((d) => d.id !== item.id);
      return [item, ...list.filter((d) => d.id !== item.id)];
    }));
  }, [team && team.id]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter((d) => !q || [d.title, d.client, d.text].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, query]);
  const open = (items || []).find((d) => d.id === selected) || null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">New proposal</h1>
        <p className="mt-2 text-muted-foreground">Paste what the client asked for. Each draft uses one credit.</p>
        {canWrite
          ? <Composer author={user} onSaved={(d) => { setItems((list) => [d, ...(list || []).filter((x) => x.id !== d.id)]); setSelected(d.id); }} />
          : <p className="mt-6 rounded-md bg-muted px-4 py-3 text-sm">You can read this team’s drafts. Ask an admin to make you a member to write new ones.</p>}
      </div>
      <section aria-labelledby="drafts-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="drafts-title" className="font-display text-xl font-semibold">{team ? team.name + '’s drafts' : 'Drafts'}</h2>
          <label className="sr-only" htmlFor="draft-search">Search drafts</label>
          <input id="draft-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        {open
          ? <DraftView draft={open} canWrite={canWrite} onClose={() => setSelected(null)} onDeleted={() => { setItems((list) => list.filter((d) => d.id !== open.id)); setSelected(null); }} />
          : <DraftList items={shown} loading={!items} onOpen={setSelected} empty={query ? 'No drafts match.' : 'No drafts yet. Your first one will appear here.'} />}
      </section>
    </div>
  );
}

function Composer({ author, onSaved }) {
  const [form, setForm] = useState({ client: '', brief: '', tone: TONES[0] });
  const [writing, setWriting] = useState(false);
  const [live, setLive] = useState('');
  const [outOfCredits, setOutOfCredits] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function write(e) {
    e.preventDefault();
    setWriting(true); setLive(''); setOutOfCredits(false);
    try {
      const prompt = 'Client: ' + form.client + '\nTone: ' + form.tone + '\nWhat they asked for:\n' + form.brief;
      const { text } = await ai.chat({ system: AI.system, max_tokens: AI.maxTokens, messages: [{ role: 'user', content: prompt }], onToken: (t) => setLive((s) => s + t) });
      const title = (text.split('\n').find((l) => l.trim()) || 'Proposal').replace(/^#+\s*/, '').slice(0, 90);
      const saved = await drafts.create({ title, client: form.client, brief: form.brief, tone: form.tone, text, author: author.name || author.email });
      onSaved(saved);
      setForm({ ...form, client: '', brief: '' }); setLive('');
      toast.success('Draft saved for your team');
    } catch (err) {
      if (err.status === 402) setOutOfCredits(true);
      else toast.error(err.message);
    } finally {
      setWriting(false);
      refreshCredits();
    }
  }

  return (
    <form onSubmit={write} className="mt-8 space-y-5">
      <div>
        <label htmlFor="client" className="mb-1.5 block text-sm font-medium">Client</label>
        <input id="client" required maxLength={120} value={form.client} onChange={set('client')} placeholder="Northpeak Outdoor" className={FIELD} />
      </div>
      <div>
        <label htmlFor="brief" className="mb-1.5 block text-sm font-medium">What they asked for</label>
        <textarea id="brief" required rows={7} maxLength={6000} value={form.brief} onChange={set('brief')} placeholder="We need a new booking flow for our rental shop before the ski season. Budget around $20k, launch by December." className={FIELD + ' resize-y'} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tone</legend>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <label key={t} className={'cursor-pointer rounded-md border px-3 py-1.5 text-sm transition ' + (form.tone === t ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}>
              <input type="radio" name="tone" value={t} checked={form.tone === t} onChange={set('tone')} className="sr-only" />{t}
            </label>
          ))}
        </div>
      </fieldset>
      {outOfCredits && (
        <p role="alert" className="rounded-md bg-muted px-4 py-3 text-sm">You have used all your credits. <Link to="/app/billing" className="font-medium text-primary underline-offset-2 hover:underline">Get more credits</Link> to keep writing.</p>
      )}
      <button disabled={writing} className="rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60">{writing ? 'Writing…' : 'Write the proposal'}</button>
      {writing && live && <pre aria-live="polite" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border p-4 font-sans text-sm leading-relaxed">{live}</pre>}
    </form>
  );
}

function DraftList({ items, loading, onOpen, empty }) {
  if (loading) return <p className="mt-6 text-sm text-muted-foreground">Loading drafts…</p>;
  if (!items.length) return <p className="mt-6 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-4 divide-y divide-border border-y border-border">
      {items.map((d) => (
        <li key={d.id}>
          <button type="button" onClick={() => onOpen(d.id)} className="w-full py-4 text-left transition hover:bg-muted/60">
            <p className="font-medium">{d.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{d.client} · {d.author} · {formatDate(d._created_at)}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DraftView({ draft, canWrite, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(draft.text); toast.success('Copied'); } catch { toast.error('Could not copy. Select the text instead.'); }
  }
  async function remove() {
    if (!confirm('Delete this draft for everyone in the team?')) return;
    setBusy(true);
    try { await drafts.remove(draft.id); onDeleted(); } catch (err) { toast.error(err.message); setBusy(false); }
  }
  return (
    <article className="mt-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button type="button" onClick={onClose} className="mr-auto text-sm text-muted-foreground hover:text-foreground">← All drafts</button>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"><Copy size={14} />Copy</button>
        {canWrite && <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"><Trash2 size={14} />Delete</button>}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">For {draft.client} · {draft.tone} · by {draft.author} · {formatDate(draft._created_at)}</p>
      {/* Drafts usually come back as Markdown: headings, lists and bold render as such. */}
      <div className="mt-4 space-y-3 leading-relaxed [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <Markdown>{draft.text}</Markdown>
      </div>
    </article>
  );
}

function formatDate(at) {
  try { return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
}
