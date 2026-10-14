import { NavLink } from 'react-router-dom';
import { House, Dumbbell, LineChart, UserRound } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/activity', label: 'Activity', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/profile', label: 'Profile', icon: UserRound }
];

// Phone: content plus a bottom tab bar. Desktop: a slim side navigation.
export default function Shell({ children }) {
  return (
    <div className="mx-auto min-h-screen max-w-6xl lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 lg:px-8">
      <aside className="hidden lg:block">
        <div className="sticky top-0 flex h-screen flex-col py-8">
          <Brand />
          <nav className="mt-10 space-y-1" aria-label="Main">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end className={({ isActive }) => 'flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition ' + (isActive ? 'bg-[#0c1222] text-white' : 'text-slate-500 hover:bg-white hover:text-[#0c1222]')}>
                <Icon size={20} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-auto text-xs text-slate-400">Estimates only, not medical advice.</p>
        </div>
      </aside>
      <div className="safe-top min-w-0 pb-28 lg:pb-12">{children}</div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/90 px-3 pt-2 backdrop-blur-xl lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => 'flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition ' + (isActive ? 'text-[#0c1222]' : 'text-slate-400')}>
              {({ isActive }) => (<><span className={'flex h-8 w-14 items-center justify-center rounded-full transition ' + (isActive ? 'bg-[#c6f432]' : '')}><Icon size={20} aria-hidden="true" /></span>{label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0c1222] text-lg">🥗</span>
      <span className="text-lg font-extrabold tracking-tight">Plate<span className="text-slate-400">&</span>Pulse</span>
    </div>
  );
}
