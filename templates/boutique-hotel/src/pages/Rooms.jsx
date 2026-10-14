import { Link } from 'react-router-dom';
import { Users, Maximize } from 'lucide-react';
import Photo from '../components/Photo.jsx';
import { ROOMS, euro } from '../lib/hotel.js';

const DETAILS = {
  garden: ['Opens onto the lemon-tree courtyard', 'Walk-in rain shower', 'Air conditioning', 'Coffee corner'],
  terrace: ['Private 12 m² terrace', 'Rooftop and river glimpses', 'Bathtub and shower', 'Nespresso machine'],
  suite: ['Whole top floor', 'Separate living room with sofa bed', 'Soaking tub by the window', 'Sunset over the Tagus']
};

export default function Rooms() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="font-display text-5xl text-[#12345c]">Rooms</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Every room has handmade tiles, linen from a family mill in Guimarães, a desk, fast Wi-Fi and breakfast on the terrace.</p>
      <div className="mt-10 space-y-8">
        {ROOMS.map((r, i) => (
          <article key={r.slug} className="grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 md:grid-cols-2">
            <Photo src={r.image} alt={r.name} className={'min-h-64 ' + (i % 2 ? 'md:order-2' : '')} />
            <div className="flex flex-col p-8">
              <h2 className="font-display text-3xl text-[#12345c]">{r.name}</h2>
              <p className="mt-2 text-slate-600">{r.tagline}</p>
              <div className="mt-4 flex gap-5 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><Users size={16} aria-hidden="true" /> Up to {r.guests} guests</span>
                <span className="flex items-center gap-1.5"><Maximize size={16} aria-hidden="true" /> {r.size} m²</span>
              </div>
              <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                {DETAILS[r.slug].map((d) => <li key={d} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4683f]" />{d}</li>)}
              </ul>
              <div className="mt-auto flex items-center justify-between pt-8">
                <p className="text-slate-500"><span className="text-2xl font-semibold text-slate-900">{euro(r.price)}</span> / night</p>
                <Link to={'/book?room=' + r.slug} className="rounded-full bg-[#c4683f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#ad5631]">Book the {r.name}</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
