import { useEffect, useState } from 'react';
import { BedDouble, Coffee, MapPin, MessageCircle, Waves, Wifi, X } from 'lucide-react';
import { collection, email } from 'kairoq';
import AssistantChat from './components/AssistantChat.jsx';

const ROOMS = [
  { name: 'Dune Room', price: 'from €120', text: 'Queen bed, garden view, rain shower.', img: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80' },
  { name: 'Ocean Room', price: 'from €165', text: 'King bed, balcony over the bay.', img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80' },
  { name: 'Family Loft', price: 'from €210', text: 'Two bedrooms under the eaves, sleeps four.', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80' }
];
const SUGGESTIONS = ['What time is check-in?', 'Is breakfast included?', 'Can I park nearby?', 'Do you allow dogs?'];

function Contact() {
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    setState({ sending: true, sent: false, error: '' });
    try {
      await collection('questions').create(data);
      email.send({ to: 'owner', subject: 'New question from the website', text: data.name + ' (' + data.email + '):\n\n' + data.message }).catch(() => {});
      setState({ sending: false, sent: true, error: '' });
      e.target.reset();
    } catch (err) { setState({ sending: false, sent: false, error: err.message }); }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input required name="name" placeholder="Your name" className="field" />
      <input required type="email" name="email" placeholder="Email" className="field" />
      <textarea required name="message" rows={4} placeholder="Your question or dates" className="field" />
      <button disabled={state.sending} className="rounded-full bg-[color:var(--ink)] px-6 py-3 font-semibold text-white disabled:opacity-60">{state.sending ? 'Sending…' : 'Send to the team'}</button>
      {state.sent && <p className="text-sm text-emerald-700">Thank you. We reply within a few hours.</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.title = 'Maré House · Guesthouse by the sea'; }, []);
  const toContact = () => { setOpen(false); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); };
  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-white">
          <a href="#" className="font-display text-2xl">Maré House</a>
          <div className="hidden gap-8 text-sm md:flex"><a href="#rooms">Rooms</a><a href="#ask">Ask us</a><a href="#stay">Your stay</a><a href="#contact">Contact</a></div>
          <a href="#contact" className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[color:var(--ink)]">Book</a>
        </nav>
      </header>

      <section className="relative grid min-h-[88vh] place-items-end overflow-hidden">
        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2000&q=80" alt="The bay in front of the house at low tide" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 text-white">
          <p className="text-sm uppercase tracking-[0.25em] text-white/80">Ericeira · Portugal</p>
          <h1 className="font-display mt-3 max-w-2xl text-5xl leading-[1.05] md:text-7xl">Eight rooms, one bay, slow mornings.</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">A small guesthouse two minutes from the beach. Questions about your stay? Our front desk answers any time of day.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#ask" className="rounded-full bg-[color:var(--brand)] px-6 py-3 font-semibold">Ask the front desk</a>
            <a href="#rooms" className="rounded-full border border-white/60 px-6 py-3 font-semibold">See the rooms</a>
          </div>
        </div>
      </section>

      <section id="rooms" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-4xl">Rooms</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ROOMS.map(r => (
            <article key={r.name} className="overflow-hidden rounded-3xl bg-white">
              <img src={r.img} alt={r.name} className="aspect-[4/3] w-full object-cover" />
              <div className="p-6">
                <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">{r.name}</h3><span className="text-sm text-[color:var(--ink-soft)]">{r.price}</span></div>
                <p className="mt-2 text-[color:var(--ink-soft)]">{r.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="ask" className="bg-[color:var(--soft)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">Front desk, open all night</p>
            <h2 className="font-display mt-3 text-4xl leading-tight">Ask us anything about your stay.</h2>
            <p className="mt-4 text-lg text-[color:var(--ink-soft)]">Check-in times, breakfast, parking, surf lessons, dogs. Answers come from our own house guide, with the page they came from. If we do not know, we say so and pass your question to the team.</p>
          </div>
          <AssistantChat title="Maré front desk" suggestions={SUGGESTIONS} onContact={toContact} />
        </div>
      </section>

      <section id="stay" className="mx-auto grid max-w-6xl gap-6 px-6 py-24 sm:grid-cols-2 md:grid-cols-4">
        {[[Coffee, 'Breakfast', 'Served 8–10:30 on the terrace.'], [Waves, 'Beach', 'Two minutes on foot, towels at the door.'], [Wifi, 'Wi-Fi', 'Fast fibre in every room.'], [BedDouble, 'Check-in', 'From 3pm, check-out by 11am.']].map(([Icon, t, d]) => (
          <div key={t} className="rounded-3xl bg-white p-6"><Icon className="text-[color:var(--brand)]" /><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1 text-[color:var(--ink-soft)]">{d}</p></div>
        ))}
      </section>

      <section id="contact" className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl">Book or ask the team</h2>
          <p className="mt-4 flex items-start gap-2 text-[color:var(--ink-soft)]"><MapPin size={18} className="mt-1 shrink-0" /> Rua da Praia 14, 2655 Ericeira, Portugal</p>
          <p className="mt-2 text-[color:var(--ink-soft)]">Tell us your dates and we confirm within a few hours.</p>
        </div>
        <Contact />
      </section>

      <footer className="border-t border-black/5 py-10 text-center text-sm text-[color:var(--ink-soft)]">© Maré House · Ericeira</footer>

      <div className="fixed bottom-5 right-5 z-30 md:hidden">
        {open && (
          <div className="fixed inset-x-3 bottom-24 z-30">
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute -top-3 right-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white shadow"><X size={16} /></button>
            <AssistantChat compact title="Maré front desk" suggestions={SUGGESTIONS} onContact={toContact} />
          </div>
        )}
        <button type="button" onClick={() => setOpen(o => !o)} aria-label="Ask the front desk" className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--brand)] text-white shadow-lg"><MessageCircle /></button>
      </div>
    </div>
  );
}
