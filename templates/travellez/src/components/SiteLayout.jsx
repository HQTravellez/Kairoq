import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

const LINKS = [
  { to: '/platform', label: 'Platform' },
  { to: '/smart-itinerary', label: 'Smart Itinerary' },
  { to: '/industries', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' }
];

export function Logo({ light }) {
  return (
    <Link to="/" className={'flex items-center gap-2 font-display text-xl font-semibold ' + (light ? 'text-white' : 'text-slate-900')} aria-label="Travellez home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset="1" stopColor="#4f46e5" /></linearGradient></defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path d="M8 21c4-9 12-12 16-10M20 9l4 2-2 4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Travellez
    </Link>
  );
}

export default function SiteLayout({ children }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const dark = pathname === '/';
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 24); f(); window.addEventListener('scroll', f); return () => window.removeEventListener('scroll', f); }, []);
  const solid = scrolled || !dark || open;
  return (
    <div className="min-h-screen flex flex-col">
      <header className={'fixed inset-x-0 top-0 z-40 transition-colors ' + (solid ? 'border-b border-slate-200/70 bg-white/85 backdrop-blur-xl' : 'bg-transparent')}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo light={!solid} />
          <nav className="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? (solid ? 'text-indigo-600' : 'text-white') : solid ? 'text-slate-600 hover:text-slate-900' : 'text-white/75 hover:text-white')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/app" className={solid ? 'text-sm font-medium text-slate-700 hover:text-slate-900' : 'text-sm font-medium text-white/80 hover:text-white'}>Sign in</Link>
            <Link to="/app" className={solid ? 'btn-primary' : 'btn-light'}>Start free <ArrowRight size={16} /></Link>
          </div>
          <button type="button" className={'rounded-lg p-2 lg:hidden ' + (solid ? 'text-slate-900' : 'text-white')} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-slate-200 bg-white px-5 pb-5 pt-2 lg:hidden" aria-label="Mobile">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} className="block py-3 text-base font-medium text-slate-800">{l.label}</NavLink>)}
            <Link to="/app" className="btn-primary mt-3 w-full">Start free</Link>
          </nav>
        )}
      </header>
      <main className={'flex-1 ' + (dark ? '' : 'pt-16')}>{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  const cols = [
    ['Product', [['Platform', '/platform'], ['Smart Itinerary', '/smart-itinerary'], ['Pricing', '/pricing']]],
    ['Company', [['About', '/about'], ['Industries', '/industries'], ['Talk to sales', '/pricing']]],
    ['Workspace', [['Sign in', '/app'], ['Create a workspace', '/app']]]
  ];
  return (
    <footer className="aurora text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">Business travel, approvals and spend in one calm workspace. Requests become approved, booked and reconciled trips without the email chains.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className="text-sm font-semibold text-white">{title}</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {links.map(([label, to]) => <li key={label}><Link to={to} className="hover:text-white">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-white/50 lg:px-8">© {new Date().getFullYear()} Travellez. Built with Kairoq.</p>
      </div>
    </footer>
  );
}
