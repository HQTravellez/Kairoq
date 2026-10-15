import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { auth } from 'kairoq';
import { LayoutDashboard, Plane, CheckCircle2, Wallet, Users, ShieldCheck, LogOut, Menu, X, Database } from 'lucide-react';
import AuthPanel from './AuthPanel.jsx';
import { Logo } from './SiteLayout.jsx';
import { WorkspaceProvider, useWorkspace } from '../lib/workspace.jsx';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/trips', label: 'Trips', icon: Plane },
  { to: '/app/approvals', label: 'Approvals', icon: CheckCircle2, badge: 'pending_approvals' },
  { to: '/app/spend', label: 'Spend', icon: Wallet },
  { to: '/app/travelers', label: 'Travelers', icon: Users },
  { to: '/app/controls', label: 'Controls', icon: ShieldCheck }
];

export default function AppShell() {
  const [user, setUser] = useState(auth.user());
  useEffect(() => auth.onChange(setUser), []);
  if (!user) return (
    <div className="aurora grid min-h-screen place-items-center px-5 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8"><Logo light /><AuthPanel /><Link to="/" className="text-sm text-white/70 hover:text-white">← Back to travellez</Link></div>
    </div>
  );
  return <WorkspaceProvider><Shell user={user} /></WorkspaceProvider>;
}

function Shell({ user }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { data, error, act } = useWorkspace();
  useEffect(() => setOpen(false), [pathname]);
  const side = (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Workspace">
      <div className="mb-6 px-2"><Logo light /></div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' + (isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/65 hover:bg-white/5 hover:text-white')}>
          <n.icon size={18} />{n.label}
          {n.badge && data && data.stats[n.badge] > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-900">{data.stats[n.badge]}</span>}
        </NavLink>
      ))}
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="truncate text-sm font-medium text-white">{user.name || user.email}</p>
        <p className="truncate text-xs text-white/50">{user.email}</p>
        <button type="button" onClick={() => auth.signOut()} className="mt-3 flex items-center gap-2 text-xs text-white/60 hover:text-white"><LogOut size={14} />Sign out</button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="aurora sticky top-0 hidden h-screen lg:block">{side}</aside>
      <div className="flex items-center justify-between bg-slate-950 px-4 py-3 lg:hidden">
        <Logo light />
        <button type="button" className="rounded-lg p-2 text-white" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {open && <div className="aurora fixed inset-x-0 bottom-0 top-14 z-40 lg:hidden">{side}</div>}
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-10">
        {error ? <p className="card p-6 text-rose-700">{error}</p>
          : !data ? <div className="space-y-4" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>
          : data.travelers.length === 0 && pathname !== '/app/travelers' ? <Welcome act={act} />
          : <Outlet />}
      </main>
    </div>
  );
}

function Welcome({ act }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-600 text-white"><Plane /></span>
      <h1 className="mt-6 font-display text-4xl font-semibold text-slate-900">Welcome to your workspace</h1>
      <p className="mt-3 text-slate-600">Start by adding the people who travel. Or load a small sample company to see how trips, approvals and spend fit together; you can remove it later by starting a new workspace.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/app/travelers" className="btn-primary px-6 py-3"><Users size={18} />Add travelers</Link>
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); await act('sample', {}, 'Sample company loaded'); setBusy(false); }} className="btn-ghost px-6 py-3"><Database size={18} />{busy ? 'Loading…' : 'Load sample data'}</button>
      </div>
    </div>
  );
}

export function PageTitle({ title, text, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl">{title}</h1>{text && <p className="mt-1 text-slate-500">{text}</p>}</div>
      {children}
    </div>
  );
}
export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <Icon className="text-slate-300" size={36} />
      <p className="mt-4 font-display text-lg font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {children}
    </div>
  );
}
