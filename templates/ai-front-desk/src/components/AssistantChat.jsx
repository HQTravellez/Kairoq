import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { ai } from 'kairoq';

// A chat that answers from the documents added in Kairoq (Data → AI assistant).
// Replies type in live and show the sources they came from.
const DONT_KNOW = /don.t know|do not know|not sure|contact (us|the)|no information/i;

function Answer({ text, sources }) {
  const parts = String(text).split(/(\[\d{1,2}\])/g);
  return (
    <>
      <p className="whitespace-pre-wrap leading-relaxed">
        {parts.map((p, i) => /^\[\d{1,2}\]$/.test(p)
          ? <sup key={i} className="ml-0.5 rounded bg-black/5 px-1 text-[10px] font-semibold text-[color:var(--ink-soft)]">{p.slice(1, -1)}</sup>
          : <span key={i}>{p}</span>)}
      </p>
      {sources && sources.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-black/5 pt-2">
          {sources.map(s => (
            <li key={s.n} className="text-xs text-[color:var(--ink-soft)]">
              <span className="font-semibold">{s.n}.</span> {s.title}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AssistantChat({ title = 'Ask us anything', intro, suggestions = [], placeholder = 'Type your question…', onContact, compact = false, initialQuestion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  const inputId = useId();
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages]);

  async function send(question) {
    const q = String(question || '').trim();
    if (!q || busy) return;
    setInput(''); setError(''); setBusy(true);
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(m => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', typing: true }]);
    const patch = fn => setMessages(m => { const copy = m.slice(); copy[copy.length - 1] = fn(copy[copy.length - 1]); return copy; });
    try {
      const { text, sources } = await ai.ask(q, { history, onToken: t => patch(last => ({ ...last, content: last.content + t })) });
      patch(() => ({ role: 'assistant', content: text, sources }));
    } catch (err) {
      setMessages(m => m.slice(0, -1));
      setError(err.status === 402 ? 'The assistant is resting right now. Please use the contact form.' : err.message);
    } finally { setBusy(false); }
  }

  // Asked straight away, e.g. from a topic the visitor picked on the page.
  useEffect(() => { if (initialQuestion) send(initialQuestion); }, []);

  const last = messages[messages.length - 1];
  return (
    <div className={'flex flex-col rounded-3xl border border-black/5 bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,.35)] ' + (compact ? 'h-[min(560px,75vh)]' : 'h-[520px]')}>
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--brand)] text-white"><Sparkles size={16} /></span>
        <div>
          <p className="font-semibold leading-tight">{title}</p>
          <p className="text-xs text-[color:var(--ink-soft)]">Answers from our own information · usually within seconds</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {!messages.length && (
          <div>
            <p className="text-[color:var(--ink-soft)]">{intro || 'Hello! Ask about rooms, prices, breakfast, parking or anything else.'}</p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-black/10 px-3 py-1.5 text-sm transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]">{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ' + (m.role === 'user' ? 'bg-[color:var(--brand)] text-white' : 'bg-[color:var(--soft)]')}>
              {m.role === 'user' ? m.content : m.typing && !m.content
                ? <span className="inline-flex gap-1 py-1" aria-label="Typing"><i className="dot" /><i className="dot" /><i className="dot" /></span>
                : <Answer text={m.content} sources={m.sources} />}
            </div>
          </div>
        ))}
        {last && last.role === 'assistant' && !busy && DONT_KNOW.test(last.content) && onContact && (
          <button type="button" onClick={onContact} className="text-sm font-semibold text-[color:var(--brand)] underline underline-offset-4">Send your question to our team</button>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-black/5 p-3">
        <label className="sr-only" htmlFor={inputId}>Your question</label>
        <input id={inputId} value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder} maxLength={500}
          className="min-w-0 flex-1 rounded-full bg-[color:var(--soft)] px-4 py-3 outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-white transition disabled:opacity-40"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
