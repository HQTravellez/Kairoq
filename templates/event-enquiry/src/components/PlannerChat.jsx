import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowUp, CalendarHeart, Check, Pencil } from 'lucide-react';
import { ai, collection, email } from 'kairoq';

// A chat that plans an event enquiry: it reads what the guest says with ai.extract, keeps what
// it already knows, and only asks for what is still missing. At the end the guest checks a
// summary and sends it; the venue gets a tidy enquiry instead of a vague email.
const SHAPE = {
  event_type: 'string?', date: 'string?', guests: 'integer?', budget: 'string?',
  name: 'string?', email: 'email?', phone: 'phone?', notes: 'string?'
};
const ASK = [
  ['event_type', 'What are you celebrating or planning? A wedding, a birthday, a company dinner…'],
  ['date', 'Which date do you have in mind? A rough idea is fine.'],
  ['guests', 'About how many guests are you expecting?'],
  ['budget', 'Do you have a budget in mind, per person or in total? You can say "not sure".'],
  ['name', 'What name should we put on the enquiry?'],
  ['email', 'And the best email for our proposal?']
];
const LABELS = { event_type: 'Event', date: 'Date', guests: 'Guests', budget: 'Budget', name: 'Name', email: 'Email', phone: 'Phone', notes: 'Notes' };
const OPENING = 'Hello! Tell me about your event in your own words, or answer a few quick questions. What are you planning?';

export default function PlannerChat() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: OPENING }]);
  const [known, setKnown] = useState({});
  const [skipped, setSkipped] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('chatting');
  const [error, setError] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, status]);

  const nextQuestion = (facts, skip) => ASK.find(([k]) => (facts[k] === undefined || facts[k] === null || facts[k] === '') && !skip.includes(k));

  async function send(text) {
    const said = text.trim();
    if (!said || busy) return;
    setInput(''); setError(''); setBusy(true);
    const convo = [...messages, { role: 'user', content: said }];
    setMessages([...convo, { role: 'assistant', content: '', typing: true }]);
    try {
      const transcript = convo.map(m => (m.role === 'user' ? 'Guest: ' : 'Venue: ') + m.content).join('\n');
      const { data } = await ai.extract({ shape: SHAPE, text: transcript, instructions: 'Fill in only what the guest has said. Keep the date and budget in the guest\'s own words (e.g. "mid June 2026", "about 60 per person").' });
      const facts = { ...known };
      for (const [k, v] of Object.entries(data)) if (v !== null && v !== '') facts[k] = v;
      const asked = nextQuestion(known, skipped);
      // "Not sure" to the budget question moves on instead of asking again.
      const skip = asked && asked[0] === 'budget' && !facts.budget && /not sure|skip|no idea|don.?t know/i.test(said) ? [...skipped, 'budget'] : skipped;
      setKnown(facts); setSkipped(skip);
      const next = nextQuestion(facts, skip);
      const got = Object.keys(facts).filter(k => known[k] !== facts[k]).map(k => LABELS[k].toLowerCase());
      const ack = got.length ? 'Got it' + (facts.name && got.includes('name') ? ', ' + String(facts.name).split(' ')[0] : '') + '. ' : '';
      if (next) setMessages([...convo, { role: 'assistant', content: ack + next[1] }]);
      else { setMessages([...convo, { role: 'assistant', content: ack + 'Here is your enquiry. Check it and send it when it looks right.' }]); setStatus('review'); }
    } catch (err) {
      setMessages(convo);
      setError(err.status === 402 ? 'The planner is resting right now. Please use the form below.' : err.message);
    } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      await collection('enquiries').create(known);
      email.send({ to: 'owner', subject: 'New event enquiry: ' + (known.event_type || 'event') + ', ' + (known.date || 'date to agree'), text: Object.entries(known).map(([k, v]) => LABELS[k] + ': ' + v).join('\n') }).catch(() => {});
      setStatus('sent');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_30px_80px_-40px_rgba(30,35,20,.45)]">
      <div className="flex items-center gap-3 border-b border-black/5 px-6 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand)] text-white"><CalendarHeart size={18} /></span>
        <div><p className="font-semibold">Plan your event</p><p className="text-xs text-[color:var(--ink-soft)]">Our planner asks only what we need for a proposal</p></div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
            <div className={'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ' + (m.role === 'user' ? 'bg-[color:var(--brand)] text-white' : 'bg-[color:var(--soft)]')}>
              {m.typing ? <span className="inline-flex gap-1 py-1" aria-label="Thinking"><i className="dot" /><i className="dot" /><i className="dot" /></span> : m.content}
            </div>
          </div>
        ))}
        {status !== 'chatting' && (
          <div className="rounded-2xl border border-[color:var(--brand)]/30 bg-[color:var(--cream)] p-4">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
              {Object.entries(known).map(([k, v]) => (<Fragment key={k}><dt className="text-[color:var(--ink-soft)]">{LABELS[k]}</dt><dd className="font-medium">{String(v)}</dd></Fragment>))}
            </dl>
            {status === 'review' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand)] px-5 py-2.5 font-semibold text-white disabled:opacity-50"><Check size={16} /> Send enquiry</button>
                <button type="button" onClick={() => { setStatus('chatting'); setMessages(m => [...m, { role: 'assistant', content: 'Of course. What should I change?' }]); }} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 font-semibold"><Pencil size={16} /> Change something</button>
              </div>
            ) : <p className="mt-4 font-semibold text-[color:var(--brand-dark)]">Thank you! We will send your proposal within one working day.</p>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div ref={end} />
      </div>
      {status === 'chatting' && (
        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-black/5 p-3">
          <label className="sr-only" htmlFor="planner-input">Your answer</label>
          <input id="planner-input" value={input} onChange={e => setInput(e.target.value)} maxLength={600} placeholder="e.g. A wedding for about 80 people in June"
            className="min-w-0 flex-1 rounded-full bg-[color:var(--soft)] px-4 py-3 outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-white disabled:opacity-40"><ArrowUp size={18} /></button>
        </form>
      )}
    </div>
  );
}
