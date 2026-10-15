import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, ChevronRight, ArrowUpRight, Mail, Phone, MapPin, Leaf } from 'lucide-react';
import useSmoothScroll from '../lib/useSmoothScroll.js';

const LINKS = [
  { to: '/product/smart-itinerary', label: 'Smart itinerary' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/savings-calculator', label: 'Savings calculator' }
];

export function Logo({ light, small }) {
  return (
    <Link to="/" className={'flex items-center gap-1 font-display font-bold ' + (small ? 'text-xl' : 'text-[26px]') + ' ' + (light ? 'text-white' : 'text-[#ef3444]')} aria-label="Travellez home">
      <svg width={small ? 20 : 26} height={small ? 20 : 26} viewBox="0 0 26 26" aria-hidden="true"><path d="M1 5.5 25 2l-9.5 21-3.4-8.6L1 5.5Z" fill="currentColor" /><path d="m12.1 14.4 3.2-3.5" stroke={light ? '#14161a' : '#fbfaf9'} strokeWidth="1.6" strokeLinecap="round" /></svg>
      <span className="tracking-[-0.06em]">travellez</span>
    </Link>
  );
}

export default function SiteLayout({ children }) {
  const [open, setOpen] = useState(false);
  const [bar, setBar] = useState(true);
  const { pathname } = useLocation();
  useSmoothScroll();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen flex flex-col">
      {bar && (
        <div className="relative bg-[#ef3444] px-10 py-2 text-center text-[13px] text-white">
          Early access is now open for growing Canadian teams. <Link to="/demo" className="ml-1 inline-flex items-center gap-0.5 font-semibold underline underline-offset-2">Request an invitation <ArrowUpRight size={13} /></Link>
          <button type="button" onClick={() => setBar(false)} aria-label="Dismiss announcement" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/15"><X size={15} /></button>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-[#edebe8] bg-[#fbfaf9]/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => 'relative py-6 transition ' + (isActive ? 'text-[#ef3444] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#ef3444]' : 'text-[#3c4048] hover:text-[#14161a]')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <Link to="/app" className="text-sm font-semibold text-[#3c4048] hover:text-[#14161a]">Log in</Link>
            <Link to="/demo" className="btn-primary">Book a demo <ChevronRight size={16} /></Link>
          </div>
          <button type="button" className="rounded-lg p-2 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {open && (
          <nav className="border-t border-[#edebe8] bg-[#fbfaf9] px-5 pb-5 pt-1 md:hidden" aria-label="Mobile">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} className="block border-b border-[#edebe8] py-3.5 text-base font-semibold">{l.label}</NavLink>)}
            <Link to="/app" className="block py-3.5 text-base font-semibold">Log in</Link>
            <Link to="/demo" className="btn-primary mt-2 w-full py-3">Book a demo</Link>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  const cols = [
    ['Get started', [['Smart itinerary', '/product/smart-itinerary'], ['Pricing', '/pricing'], ['Savings calculator', '/savings-calculator'], ['Book a demo', '/demo']]],
    ['Solutions', [['Finance & CFOs', '/solutions/finance'], ['Travel managers', '/solutions/travel-managers'], ['Travelers', '/solutions/travelers']]],
    ['Account', [['Log in', '/app'], ['Create a workspace', '/app']]]
  ];
  return (
    <footer className="border-t border-[#edebe8] bg-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo small />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#5f646d]">Business travel that respects everyone's time. Booking, approvals and expense reporting under one login.</p>
          <ul className="mt-5 space-y-2 text-sm text-[#3c4048]">
            <li className="flex items-center gap-2"><Mail size={15} className="text-[#ef3444]" /><a href="mailto:info@travellez.com" className="hover:underline">info@travellez.com</a></li>
            <li className="flex items-center gap-2"><Phone size={15} className="text-[#ef3444]" /><a href="tel:18663430689" className="hover:underline">1-866-343-0689</a></li>
            <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[#ef3444]" />2030 Bristol Cir #210, Oakville, ON L6H 0H2</li>
          </ul>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#e8f6ee] px-3 py-1 text-xs font-semibold text-[#17804a]"><Leaf size={13} />Carbon-conscious travel</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className="eyebrow">{title}</p>
            <ul className="mt-4 space-y-2.5 text-sm font-medium text-[#3c4048]">{links.map(([label, to]) => <li key={label}><Link to={to} className="hover:text-[#ef3444]">{label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#edebe8]"><p className="mx-auto max-w-[1280px] px-5 py-5 text-xs text-[#8a8e96] lg:px-8">© {new Date().getFullYear()} Travellez. All rights reserved. · IATA # 67600035 · TICO # 5003155</p></div>
    </footer>
  );
}
