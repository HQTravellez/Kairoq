import { useEffect, useRef, useState } from 'react';
import { HeartHandshake, Leaf, Mail, PawPrint, RotateCcw, Truck } from 'lucide-react';
import { collection, email } from 'kairoq';
import AssistantChat from './components/AssistantChat.jsx';

const TOPICS = [
  [Truck, 'Delivery', 'When will my plant arrive?'],
  [RotateCcw, 'Returns', 'My plant arrived damaged. What can I do?'],
  [Leaf, 'Plant care', 'How often should I water a monstera?'],
  [PawPrint, 'Pets', 'Which plants are safe for cats?'],
  [HeartHandshake, 'Guarantee', 'What does the 30-day guarantee cover?'],
  [Mail, 'Orders', 'How do I track my order?']
];

function ContactForm() {
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    setState({ sending: true, sent: false, error: '' });
    try {
      await collection('questions').create(data);
      email.send({ to: 'owner', subject: 'Help centre question', text: data.name + ' (' + data.email + ')\nOrder: ' + (data.order || '-') + '\n\n' + data.message }).catch(() => {});
      setState({ sending: false, sent: true, error: '' });
      e.target.reset();
    } catch (err) { setState({ sending: false, sent: false, error: err.message }); }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input required name="name" placeholder="Your name" className="field" />
      <input required type="email" name="email" placeholder="Email" className="field" />
      <input name="order" placeholder="Order number (optional)" className="field sm:col-span-2" />
      <textarea required name="message" rows={4} placeholder="How can we help?" className="field sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={state.sending} className="rounded-full bg-[color:var(--brand)] px-6 py-3 font-semibold text-white disabled:opacity-60">{state.sending ? 'Sending…' : 'Send message'}</button>
        {state.sent && <p className="text-sm text-emerald-700">Thanks, we reply within one working day.</p>}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

export default function App() {
  const [chatKey, setChatKey] = useState(0);
  const [first, setFirst] = useState('');
  const chat = useRef(null);
  useEffect(() => { document.title = 'Fernway Help Centre'; }, []);
  const ask = q => { setFirst(q); setChatKey(k => k + 1); chat.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const toContact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <a href="#" className="font-display text-2xl text-[color:var(--brand)]">Fernway</a>
        <a href="#contact" className="text-sm font-semibold">Contact us</a>
      </header>
      <section className="mx-auto max-w-5xl px-6 pb-10 pt-8 text-center">
        <h1 className="font-display text-5xl leading-tight md:text-6xl">How can we help?</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[color:var(--ink-soft)]">Ask about delivery, returns or caring for your plants. Answers come from our help articles, with the article they came from.</p>
      </section>
      <section ref={chat} className="mx-auto max-w-3xl px-6">
        <AssistantChat key={chatKey} title="Fernway help" intro="Ask a question in your own words." initialQuestion={first} suggestions={['When will my plant arrive?', 'Can I return a plant?']} placeholder="e.g. Is a snake plant safe for my cat?" onContact={toContact} />
      </section>
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">Popular topics</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {TOPICS.map(([Icon, title, q]) => (
            <button key={title} type="button" onClick={() => ask(q)} className="rounded-3xl bg-white p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <Icon className="text-[color:var(--brand)]" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">{q}</p>
            </button>
          ))}
        </div>
      </section>
      <section id="contact" className="bg-[color:var(--soft)]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="font-display text-3xl">Still need help?</h2>
          <p className="mt-2 text-[color:var(--ink-soft)]">Our team replies within one working day.</p>
          <div className="mt-8"><ContactForm /></div>
        </div>
      </section>
      <footer className="py-10 text-center text-sm text-[color:var(--ink-soft)]">© Fernway Plants</footer>
    </div>
  );
}
