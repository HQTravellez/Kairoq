import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coffee, Sun, Wifi, Star, Footprints } from 'lucide-react';
import Photo from '../components/Photo.jsx';
import { ROOMS, GALLERY, NEARBY, euro } from '../lib/hotel.js';

const REVIEWS = [
  { name: 'Hannah, Berlin', text: 'The terrace breakfast with the whole of Alfama below us was the best start to every day.', stars: 5 },
  { name: 'Marco, Milan', text: 'Quiet rooms in the middle of everything. Inês sent us to a fado house we would never have found.', stars: 5 },
  { name: 'Aiko, Kyoto', text: 'Spotless, beautifully tiled, and the bed linen is unbelievably soft.', stars: 5 }
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Photo src="https://images.unsplash.com/photo-1588535684374-fb52dcf29405?w=2000&q=80" alt="Alfama rooftops above the Tagus" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#12345c]/70 via-[#12345c]/45 to-[#12345c]/80" />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-28 text-white sm:pb-32 sm:pt-40">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">Boutique hotel · Alfama, Lisbon</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="font-display mt-4 max-w-2xl text-5xl leading-[1.05] sm:text-7xl">Wake up above the oldest rooftops in Lisbon.</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-6 max-w-xl text-lg text-white/85">Twelve rooms in a tiled 18th-century house, a lemon-tree courtyard, and breakfast on the terrace with the river in view.</motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-9 flex flex-wrap gap-3">
            <Link to="/book" className="rounded-full bg-[#c4683f] px-7 py-3.5 font-medium shadow-lg shadow-black/20 transition hover:bg-[#ad5631]">Check availability</Link>
            <Link to="/rooms" className="rounded-full bg-white/15 px-7 py-3.5 font-medium backdrop-blur transition hover:bg-white/25">See the rooms</Link>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Sun, 'Rooftop terrace', 'Sunrise to sunset over the Tagus'],
          [Coffee, 'Breakfast included', 'Pastéis de nata from next door'],
          [Footprints, 'Walk everywhere', 'Castle, trams and fado nearby'],
          [Wifi, 'Fast Wi-Fi', 'And quiet desks in every room']
        ].map(([Icon, title, text]) => (
          <div key={title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <Icon className="text-[#c4683f]" size={26} aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#c4683f]">Rooms</p>
            <h2 className="font-display mt-2 text-4xl text-[#12345c]">Three ways to stay</h2>
          </div>
          <Link to="/rooms" className="text-sm font-medium text-[#1d4e89] hover:underline">All room details →</Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {ROOMS.map((r) => (
            <Link key={r.slug} to="/rooms" className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-lg">
              <Photo src={r.image} alt={r.name} className="aspect-[4/3] transition duration-500 group-hover:scale-[1.03]" />
              <div className="p-6">
                <h3 className="font-display text-2xl text-[#12345c]">{r.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{r.tagline}</p>
                <p className="mt-4 text-sm text-slate-500">From <span className="text-lg font-semibold text-slate-900">{euro(r.price)}</span> / night</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-5">
        <h2 className="font-display text-4xl text-[#12345c]">Life at Casa Azul</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {GALLERY.map((g, i) => <Photo key={g.src} src={g.src} alt={g.alt} className={'rounded-2xl ' + (i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square')} />)}
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-10 px-5 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl text-[#12345c]">What guests say</h2>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-600"><Star size={16} className="fill-[#c4683f] text-[#c4683f]" aria-hidden="true" /> 4.9 average from 612 stays</p>
          <div className="mt-6 space-y-4">
            {REVIEWS.map((r) => (
              <figure key={r.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <blockquote className="text-slate-700">“{r.text}”</blockquote>
                <figcaption className="mt-3 text-sm font-medium text-slate-500">{r.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-4xl text-[#12345c]">On your doorstep</h2>
          <ul className="mt-6 divide-y divide-black/5 rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {NEARBY.map((n) => (
              <li key={n.name} className="flex items-center justify-between gap-4 px-6 py-4">
                <div><p className="font-medium text-slate-900">{n.name}</p><p className="text-sm text-slate-500">{n.note}</p></div>
                <span className="shrink-0 rounded-full bg-[#f6f1e8] px-3 py-1 text-xs font-medium text-slate-700">{n.walk} walk</span>
              </li>
            ))}
          </ul>
          <a href="https://maps.google.com/?q=Rua+dos+Remedios+42+Lisboa" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-[#1d4e89] hover:underline">Open in Google Maps →</a>
        </div>
      </section>
    </>
  );
}
