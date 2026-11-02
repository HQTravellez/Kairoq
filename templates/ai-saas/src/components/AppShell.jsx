import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { auth, teams } from 'kairoq';
import { CreditsBadge, TeamSwitcher } from 'kairoq/saas';
import { PRODUCT } from '../saas.config.js';
import { useSession, useTeam } from '../lib/session.js';

const LINKS = [
  { to: '/app', label: 'Drafts', end: true },
  { to: '/app/team', label: 'Team' },
  { to: '/app/billing', label: 'Billing' }
];

// The signed-in part of the app: needs an account and a team, then shows the page inside the frame.
export default function AppShell() {
  const { user, ready } = useSession();
  const { team, teams: list, loading } = useTeam(user);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  if (!ready || loading) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <Navigate to={'/signin?next=' + encodeURIComponent(pathname)} replace />;
  if (list && list.length === 0) return <FirstTeam name={user.name} />;
  if (!team) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;

  const links = user.manager ? [...LINKS, { to: '/app/admin', label: 'Admin' }] : LINKS;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/app" className="font-display text-xl font-semibold tracking-tight">{PRODUCT.name}</Link>
          <nav aria-label="App" className="hidden items-center gap-1 text-sm md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'rounded-md px-3 py-2 transition ' + (isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <TeamSwitcher />
            <CreditsBadge />
            <button type="button" onClick={() => auth.signOut()} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
          </div>
          <button type="button" className="ml-auto rounded-md p-2 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {open && (
          <nav aria-label="App" className="border-t border-border px-5 pb-4 md:hidden">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className="block py-3 font-medium">{l.label}</NavLink>)}
            <div className="flex items-center justify-between pt-2"><CreditsBadge /><button type="button" onClick={() => auth.signOut()} className="text-sm text-muted-foreground">Sign out</button></div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10"><Outlet /></main>
    </div>
  );
}

// First visit after sign-up: every customer works inside a team, even a team of one.
function FirstTeam({ name }) {
  const [value, setValue] = useState(name ? name.split(' ')[0] + '’s team' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await teams.create(value); } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <form onSubmit={create} className="w-full max-w-md">
        <p className="text-sm font-medium text-muted-foreground">{PRODUCT.name}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Name your team</h1>
        <p className="mt-2 text-muted-foreground">Your drafts live in a team, so colleagues can pick them up. You can invite them later.</p>
        <label htmlFor="team-name" className="mt-8 block text-sm font-medium">Team name</label>
        <input id="team-name" required maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5" />
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <button disabled={busy || !value.trim()} className="mt-6 w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">{busy ? 'Creating…' : 'Continue'}</button>
      </form>
    </div>
  );
}
