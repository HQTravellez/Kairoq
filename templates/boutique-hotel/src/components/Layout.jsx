import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, MapPin, Mail, Phone } from 'lucide-react';
import { HOTEL } from '../lib/hotel.js';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/stays', label: 'My stays' }
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f1e8]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="font-display text-2xl text-[#12345c]">Casa Azul</Link>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? 'text-[#1d4e89]' : 'text-slate-600 hover:text-slate-900')}>{l.label}</NavLink>
            ))}
            <Link to="/book" className="rounded-full bg-[#c4683f] px-5 py-2.5 text-white shadow-sm transition hover:bg-[#ad5631]">Book a stay</Link>
          </nav>
          <button type="button" className="rounded-lg p-2 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-black/5 px-5 pb-4 md:hidden" aria-label="Mobile">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end className="block py-3 text-base font-medium text-slate-700">{l.label}</NavLink>)}
            <Link to="/book" className="mt-2 block rounded-full bg-[#c4683f] py-3 text-center font-medium text-white">Book a stay</Link>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="tile-pattern mt-20 text-white/90">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
          <div>
            <p className="font-display text-2xl text-white">Casa Azul</p>
            <p className="mt-2 text-sm text-white/75">Twelve rooms in an 18th-century house in Alfama. Family run since 2009.</p>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" />{HOTEL.address}</li>
            <li className="flex gap-2"><Mail size={16} className="mt-0.5 shrink-0" /><a href={'mailto:' + HOTEL.email} className="underline-offset-2 hover:underline">{HOTEL.email}</a></li>
            <li className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0" />{HOTEL.phone}</li>
          </ul>
          <div className="text-sm text-white/75">
            <p>Check-in from {HOTEL.checkIn} · Check-out by {HOTEL.checkOut}</p>
            <p className="mt-2">Free cancellation up to the day before arrival.</p>
            <Link to="/owner" className="mt-4 inline-block text-xs text-white/50 hover:text-white">Team sign-in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
