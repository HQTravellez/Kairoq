import { useEffect, useState } from 'react';
import { Leaf, MapPin, Music, Users, UtensilsCrossed } from 'lucide-react';
import { collection, email } from 'kairoq';
import PlannerChat from './components/PlannerChat.jsx';

const SPACES = [
  { name: 'The Olive Terrace', guests: 'Up to 120 guests', text: 'Long tables under four-hundred-year-old olive trees, lit with festoon lights after sunset.', img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80' },
  { name: 'The Stone Barn', guests: 'Up to 80 guests', text: 'Exposed stone, oak beams and a dance floor. Warm in winter, cool in summer.', img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=80' },
  { name: 'The Garden Room', guests: 'Up to 30 guests', text: 'A glass room in the herb garden for rehearsal dinners, birthdays and team days.', img: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&q=80' }
];

function QuickForm() {
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    setState({ sending: true, sent: false, error: '' });
    try {
      await collection('enquiries').create(data);
      email.send({ to: 'owner', subject: 'New event enquiry (form)', text: Object.entries(data).map(([k, v]) => k + ': ' + v).join('\n') }).catch(() => {});
      setState({ sending: false, sent: true, error: '' });
      e.target.reset();
    } catch (err) { setState({ sending: false, sent: false, error: err.message }); }
  }
  const field = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[color:var(--brand)]';
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input required name="name" placeholder="Your name" className={field} />
      <input required type="email" name="email" placeholder="Email" className={field} />
      <input name="event_type" placeholder="Type of event" className={field} />
      <input name="date" placeholder="Date (roughly)" className={field} />
      <input name="guests" type="number" min="1" placeholder="Guests" className={field} />
      <input name="budget" placeholder="Budget (optional)" className={field} />
      <textarea name="notes" rows={3} placeholder="Anything else?" className={field + ' sm:col-span-2'} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={state.sending} className="rounded-full bg-[color:var(--ink)] px-6 py-3 font-semibold text-white disabled:opacity-60">{state.sending ? 'Sending…' : 'Send enquiry'}</button>
        {state.sent && <p className="text-sm text-emerald-700">Thank you, we will be in touch within a day.</p>}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

export default function App() {
  useEffect(() => { document.title = 'Olive Grove · Weddings and events in the hills'; }, []);
  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-white">
          <a href="#" className="font-display text-3xl">Olive Grove</a>
          <div className="hidden gap-8 text-sm md:flex"><a href="#spaces">Spaces</a><a href="#plan">Plan your event</a><a href="#visit">Visit</a></div>
          <a href="#plan" className="rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-[color:var(--ink)]">Enquire</a>
        </nav>
      </header>

      <section className="relative grid min-h-[86vh] place-items-end overflow-hidden">
        <img src="https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=2000&q=80" alt="Long tables laid for a wedding dinner outdoors" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/30" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 text-white">
          <p className="text-sm uppercase tracking-[0.3em] text-white/80">Weddings · Celebrations · Company days</p>
          <h1 className="font-display mt-4 max-w-3xl text-6xl leading-[1.02] md:text-7xl">An olive farm in the hills, for the days you remember.</h1>
          <a href="#plan" className="mt-8 inline-block rounded-full bg-[color:var(--brand)] px-7 py-3 font-semibold">Plan your event</a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-10 text-[color:var(--ink-soft)] sm:grid-cols-2 md:grid-cols-4">
        {[[Users, 'From 10 to 120 guests'], [UtensilsCrossed, 'Our own kitchen, local produce'], [Music, 'Music until midnight'], [Leaf, 'Rooms for 40 guests on site']].map(([Icon, t]) => (
          <p key={t} className="flex items-center gap-3"><Icon className="text-[color:var(--brand)]" size={20} /> {t}</p>
        ))}
      </section>

      <section id="spaces" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-5xl">Our spaces</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SPACES.map(s => (
            <article key={s.name} className="overflow-hidden rounded-3xl bg-white">
              <img src={s.img} alt={s.name} className="aspect-[4/3] w-full object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-semibold">{s.name}</h3>
                <p className="text-sm font-medium text-[color:var(--brand)]">{s.guests}</p>
                <p className="mt-2 text-[color:var(--ink-soft)]">{s.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="plan" className="bg-[color:var(--soft)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.15fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">Start here</p>
            <h2 className="font-display mt-3 text-5xl leading-tight">Tell us about your day.</h2>
            <p className="mt-4 text-lg text-[color:var(--ink-soft)]">Describe it in your own words. Our planner picks out the date, the number of guests and what you have in mind, asks only for what is missing, and sends us a tidy enquiry. You get a tailored proposal within one working day.</p>
            <details className="mt-8 rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">Prefer a form?</summary>
              <div className="mt-4"><QuickForm /></div>
            </details>
          </div>
          <PlannerChat />
        </div>
      </section>

      <section id="visit" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-4xl">Come and see it</h2>
        <p className="mt-3 flex items-center gap-2 text-[color:var(--ink-soft)]"><MapPin size={18} /> Quinta da Oliveira, Estrada do Monte 12, Sintra · viewings every Saturday by appointment</p>
      </section>
      <footer className="border-t border-black/5 py-10 text-center text-sm text-[color:var(--ink-soft)]">© Olive Grove events</footer>
    </div>
  );
}
