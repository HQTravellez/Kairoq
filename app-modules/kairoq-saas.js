// kairoq/saas: the account pages every SaaS needs, ready to drop into a page.
//
// <BillingPage plans={[{ product: 'pro', name: 'Pro', price: '$29 a month', features: ['...'] }]} />
//   The customer's plan, upgrades, Stripe's billing page (card, invoices, cancel) and, when the
//   app sells credits, the balance, credit packs and recent use.
// <TeamPage />      The current team: members and roles, invite links, create, switch and leave teams.
// <AdminPage plans={...} />  For the app's managers: sign-ups, paying customers, credits, and giving credits.
// <TeamSwitcher />  A compact team picker for the navigation bar.
// <CreditsBadge />  The signed-in customer's credit balance; call refreshCredits() after AI use.
//
// They use the app's design tokens (bg-background, text-foreground, primary, muted, border), so
// they take on each app's own colours and fonts. Wrap them in the app's own layout.
import React, { useCallback, useEffect, useState } from 'react';
import { auth, credits, payments, teams, admin } from 'kairoq';

const h = React.createElement;
const cx = (...a) => a.filter(Boolean).join(' ');

// ---------- small pieces ----------
function Button({ kind = 'primary', className, ...props }) {
  const look = kind === 'primary'
    ? 'bg-primary text-primary-foreground hover:opacity-90'
    : kind === 'danger'
      ? 'border border-border text-destructive hover:bg-destructive/10'
      : 'border border-border bg-background text-foreground hover:bg-muted';
  return h('button', { type: 'button', ...props, className: cx('inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', look, className) });
}
function Section({ title, note, action, children }) {
  return h('section', { className: 'border-t border-border py-8 first:border-t-0 first:pt-0' },
    h('div', { className: 'mb-5 flex flex-wrap items-end justify-between gap-3' },
      h('div', null,
        h('h2', { className: 'font-display text-lg font-semibold text-foreground' }, title),
        note ? h('p', { className: 'mt-1 max-w-prose text-sm text-muted-foreground' }, note) : null),
      action || null),
    children);
}
function Notice({ tone = 'info', children }) {
  if (!children) return null;
  return h('p', { role: tone === 'error' ? 'alert' : 'status', className: cx('rounded-md px-3 py-2 text-sm', tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground') }, children);
}
function Loading() { return h('p', { className: 'py-6 text-sm text-muted-foreground' }, 'Loading…'); }
function SignedOut() { return h('p', { className: 'py-6 text-sm text-muted-foreground' }, 'Sign in to see this page.'); }
function when(at) { try { return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } }
function money(amount, currency) {
  if (amount == null) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount / 100); } catch { return String(amount / 100); }
}
// A product's name: the plan's own name when the page knows it, else "credits_500" → "Credits 500".
function nameOf(product, plans = []) {
  const plan = plans.find((p) => p.product === product);
  if (plan) return plan.name;
  const t = String(product || '').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function useUser() {
  const [user, setUser] = useState(auth.user());
  const [ready, setReady] = useState(false);
  useEffect(() => { let live = true; auth.ready().then(() => { if (live) { setUser(auth.user()); setReady(true); } }); const off = auth.onChange(setUser); return () => { live = false; off(); }; }, []);
  return { user, ready };
}
// Runs an action, keeping its busy state and error message.
function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = useCallback(async (fn) => { setBusy(true); setError(''); try { return await fn(); } catch (e) { setError(e.message || 'Something went wrong'); } finally { setBusy(false); } }, []);
  return { busy, error, setError, run };
}

// ---------- credits ----------
const CREDITS_EVENT = 'kairoq:credits';
export function refreshCredits() { try { window.dispatchEvent(new Event(CREDITS_EVENT)); } catch {} }
function useCredits(user) {
  const [data, setData] = useState(null), [off, setOff] = useState(false);
  const load = useCallback(() => {
    if (!user) return;
    credits.mine().then(setData).catch((e) => { if (e.status === 404) setOff(true); });
  }, [user && user.id]);
  useEffect(() => { load(); window.addEventListener(CREDITS_EVENT, load); return () => window.removeEventListener(CREDITS_EVENT, load); }, [load]);
  return { data, off, reload: load };
}
export function CreditsBadge({ className }) {
  const { user } = useUser();
  const { data, off } = useCredits(user);
  if (!user || off || !data) return null;
  return h('span', { className: cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums text-foreground', className), title: 'Each AI request uses ' + data.ai_cost + ' credit' + (data.ai_cost === 1 ? '' : 's') },
    h('span', { 'aria-hidden': true, className: cx('h-1.5 w-1.5 rounded-full', data.balance > data.ai_cost * 3 ? 'bg-primary' : 'bg-destructive') }),
    data.balance.toLocaleString() + ' credits');
}

// ---------- billing ----------
export function BillingPage({ plans = [], title = 'Billing' }) {
  const { user, ready } = useUser();
  const { data: cr, off: noCredits } = useCredits(user);
  const [purchases, setPurchases] = useState(null);
  const act = useAction();
  useEffect(() => { if (user) payments.purchases().then(setPurchases).catch(() => setPurchases([])); }, [user && user.id]);
  let status = '';
  try { status = new URLSearchParams(location.search).get('kairoq_payment') || ''; } catch {}
  if (!ready) return h(Loading);
  if (!user) return h(SignedOut);
  const active = (purchases || []).filter((p) => p.mode === 'subscription' && p.status === 'active').map((p) => p.product);
  const current = plans.find((p) => active.includes(p.product));
  return h('div', { className: 'mx-auto w-full max-w-3xl text-foreground' },
    h('h1', { className: 'mb-8 font-display text-3xl font-semibold tracking-tight' }, title),
    status === 'success' ? h('div', { className: 'mb-6' }, h(Notice, null, 'Thank you. Your payment went through; it can take a moment to show here.')) : null,
    status === 'cancelled' ? h('div', { className: 'mb-6' }, h(Notice, null, 'The payment was cancelled. Nothing was charged.')) : null,
    h(Section, {
      title: 'Your plan',
      note: current ? 'You are on ' + current.name + '.' : active.length ? 'You have an active subscription.' : 'You are on the free plan.',
      action: purchases && purchases.length ? h(Button, { kind: 'secondary', disabled: act.busy, onClick: () => act.run(() => payments.manage()) }, 'Manage billing') : null
    },
      plans.length ? h('ul', { className: 'divide-y divide-border rounded-lg border border-border' },
        plans.map((p) => {
          const mine = active.includes(p.product);
          return h('li', { key: p.product, className: 'flex flex-wrap items-center justify-between gap-4 p-4' },
            h('div', { className: 'min-w-0' },
              h('p', { className: 'font-medium' }, p.name, mine ? h('span', { className: 'ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground' }, 'Current') : null),
              p.price ? h('p', { className: 'text-sm text-muted-foreground' }, p.price) : null,
              p.features && p.features.length ? h('p', { className: 'mt-1 text-sm text-muted-foreground' }, p.features.join(' · ')) : null),
            mine ? null : h(Button, { disabled: act.busy, onClick: () => act.run(() => payments.checkout(p.product)) }, current ? 'Switch' : 'Upgrade'));
        })) : null,
      h('div', { className: 'mt-3' }, h(Notice, { tone: 'error' }, act.error))),
    !noCredits && cr ? h(Section, { title: 'Credits', note: 'Each AI request uses ' + cr.ai_cost + ' credit' + (cr.ai_cost === 1 ? '' : 's') + '. If a request fails, its credits come back.' },
      h('p', { className: 'font-display text-4xl font-semibold tabular-nums' }, cr.balance.toLocaleString(), h('span', { className: 'ml-2 text-base font-normal text-muted-foreground' }, 'left')),
      cr.packs.filter((p) => p.mode === 'payment').length ? h('div', { className: 'mt-5 flex flex-wrap gap-2' },
        cr.packs.filter((p) => p.mode === 'payment').map((p) => h(Button, { key: p.product, kind: 'secondary', disabled: act.busy, onClick: () => act.run(() => credits.buy(p.product)) }, 'Buy ' + p.credits.toLocaleString() + ' credits'))) : null,
      cr.history.length ? h('table', { className: 'mt-6 w-full text-sm' },
        h('caption', { className: 'sr-only' }, 'Recent credit changes'),
        h('tbody', null, cr.history.map((r, i) => h('tr', { key: i, className: 'border-t border-border' },
          h('td', { className: 'py-2 pr-4 text-muted-foreground' }, when(r.at)),
          h('td', { className: 'py-2 pr-4' }, r.reason),
          h('td', { className: cx('py-2 text-right tabular-nums', r.change < 0 ? 'text-muted-foreground' : 'text-foreground') }, (r.change > 0 ? '+' : '') + r.change.toLocaleString()))))) : null) : null,
    purchases && purchases.length ? h(Section, { title: 'Purchases' },
      h('ul', { className: 'space-y-2 text-sm' }, purchases.map((p, i) => h('li', { key: i, className: 'flex justify-between gap-4' },
        h('span', null, nameOf(p.product, plans)),
        h('span', { className: 'text-muted-foreground' }, (p.status === 'active' ? '' : p.status + ' · ') + when(p.created_at)))))) : null);
}

// ---------- teams ----------
function useTeams(user) {
  const [list, setList] = useState(null), [current, setCurrent] = useState(teams.current());
  const load = useCallback(async () => {
    if (!user) return;
    const all = await teams.list().catch(() => []);
    setList(all);
    // Keep a valid current team: the saved one if still a member, else the first.
    const now = teams.current();
    if (!all.some((t) => t.id === now)) teams.use(all[0] ? all[0].id : null);
  }, [user && user.id]);
  useEffect(() => { load(); const off = teams.onChange((id) => setCurrent(id)); return off; }, [load]);
  return { list, current, team: (list || []).find((t) => t.id === current) || null, reload: load };
}
export function TeamSwitcher({ className }) {
  const { user } = useUser();
  const { list, current } = useTeams(user);
  if (!user || !list || list.length < 2) return null;
  return h('label', { className: cx('inline-flex items-center gap-2 text-sm', className) },
    h('span', { className: 'sr-only' }, 'Team'),
    h('select', { value: current || '', onChange: (e) => teams.use(e.target.value), className: 'rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground' },
      list.map((t) => h('option', { key: t.id, value: t.id }, t.name))));
}
const ROLE_NOTE = { owner: 'Everything, including billing and deleting the team', admin: 'Invites people and manages members', member: 'Adds and edits the team’s work', viewer: 'Can look, cannot change anything' };
export function TeamPage({ title = 'Team' }) {
  const { user, ready } = useUser();
  const { list, team, reload } = useTeams(user);
  const [members, setMembers] = useState(null), [name, setName] = useState(''), [role, setRole] = useState('member'), [link, setLink] = useState(null), [copied, setCopied] = useState(false);
  const act = useAction();
  const loadMembers = useCallback(() => { if (team) teams.members(team.id).then(setMembers).catch(() => setMembers([])); else setMembers(null); }, [team && team.id]);
  useEffect(() => { loadMembers(); setLink(null); }, [loadMembers]);
  if (!ready) return h(Loading);
  if (!user) return h(SignedOut);
  if (!list) return h(Loading);
  const canManage = team && (team.role === 'owner' || team.role === 'admin');
  const create = h('form', { className: 'flex flex-wrap gap-2', onSubmit: (e) => { e.preventDefault(); act.run(async () => { await teams.create(name); setName(''); await reload(); }); } },
    h('label', { className: 'sr-only', htmlFor: 'kq-team-name' }, 'Team name'),
    h('input', { id: 'kq-team-name', value: name, onChange: (e) => setName(e.target.value), required: true, maxLength: 80, placeholder: 'Team name', className: 'min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm' }),
    h(Button, { type: 'submit', disabled: act.busy || !name.trim() }, 'Create team'));
  if (!team) return h('div', { className: 'mx-auto w-full max-w-xl text-foreground' },
    h('h1', { className: 'mb-2 font-display text-3xl font-semibold tracking-tight' }, title),
    h('p', { className: 'mb-6 text-muted-foreground' }, 'Create a team to work with colleagues. You can invite them with a link once it exists.'),
    create, h('div', { className: 'mt-3' }, h(Notice, { tone: 'error' }, act.error)));
  return h('div', { className: 'mx-auto w-full max-w-3xl text-foreground' },
    h('div', { className: 'mb-8 flex flex-wrap items-baseline justify-between gap-3' },
      h('h1', { className: 'font-display text-3xl font-semibold tracking-tight' }, team.name),
      list.length > 1 ? h(TeamSwitcher) : null),
    h(Notice, { tone: 'error' }, act.error),
    h(Section, { title: 'Members', note: 'You are ' + (team.role === 'owner' ? 'the owner' : 'a' + (team.role === 'admin' ? 'n admin' : ' ' + team.role)) + ' of this team.' },
      !members ? h(Loading) : h('ul', { className: 'divide-y divide-border rounded-lg border border-border' }, members.map((m) => {
        const me = m.user_id === user.id;
        const editable = canManage && !me && m.role !== 'owner' && (team.role === 'owner' || m.role !== 'admin');
        return h('li', { key: m.user_id, className: 'flex flex-wrap items-center justify-between gap-3 p-4' },
          h('div', { className: 'min-w-0' },
            h('p', { className: 'truncate font-medium' }, (m.name || m.email) + (me ? ' (you)' : '')),
            m.name ? h('p', { className: 'truncate text-sm text-muted-foreground' }, m.email) : null),
          h('div', { className: 'flex items-center gap-2' },
            editable
              ? h('select', { 'aria-label': 'Role of ' + m.email, value: m.role, disabled: act.busy, onChange: (e) => act.run(async () => { await teams.setRole(m.user_id, e.target.value, team.id); loadMembers(); }), className: 'rounded-md border border-border bg-background px-2 py-1.5 text-sm' },
                (team.role === 'owner' ? ['owner', 'admin', 'member', 'viewer'] : ['member', 'viewer']).map((r) => h('option', { key: r, value: r }, cap(r))))
              : h('span', { className: 'text-sm capitalize text-muted-foreground', title: ROLE_NOTE[m.role] }, m.role),
            editable ? h(Button, { kind: 'danger', disabled: act.busy, onClick: () => { if (confirm('Remove ' + m.email + ' from ' + team.name + '?')) act.run(async () => { await teams.removeMember(m.user_id, team.id); loadMembers(); }); } }, 'Remove') : null));
      }))),
    canManage ? h(Section, { title: 'Invite people', note: 'Each link works once and for 7 days. Send it to one person.' },
      h('div', { className: 'flex flex-wrap items-center gap-2' },
        h('label', { className: 'text-sm', htmlFor: 'kq-invite-role' }, 'Role'),
        h('select', { id: 'kq-invite-role', value: role, onChange: (e) => setRole(e.target.value), className: 'rounded-md border border-border bg-background px-2 py-2 text-sm' },
          (team.role === 'owner' ? ['admin', 'member', 'viewer'] : ['member', 'viewer']).map((r) => h('option', { key: r, value: r }, cap(r)))),
        h(Button, { disabled: act.busy, onClick: () => act.run(async () => { setCopied(false); setLink(await teams.invite(role, team.id)); }) }, 'Create invite link')),
      h('p', { className: 'mt-2 text-sm text-muted-foreground' }, ROLE_NOTE[role]),
      link ? h('div', { className: 'mt-4 flex flex-wrap gap-2' },
        h('input', { readOnly: true, value: link.link, 'aria-label': 'Invite link', onFocus: (e) => e.target.select(), className: 'min-w-0 flex-1 rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs' }),
        h(Button, { kind: 'secondary', onClick: async () => { try { await navigator.clipboard.writeText(link.link); setCopied(true); } catch { setCopied(false); } } }, copied ? 'Copied' : 'Copy')) : null) : null,
    h(Section, { title: 'Other teams', note: 'Start another team for a different client or department.' }, create),
    h(Section, { title: team.role === 'owner' ? 'Delete team' : 'Leave team', note: team.role === 'owner' ? 'Deleting removes the team and everything saved in it for every member. It cannot be undone.' : 'You will lose access to this team’s work until someone invites you again.' },
      h(Button, { kind: 'danger', disabled: act.busy, onClick: () => {
        if (!confirm(team.role === 'owner' ? 'Delete ' + team.name + ' and everything in it?' : 'Leave ' + team.name + '?')) return;
        act.run(async () => { if (team.role === 'owner') await teams.remove(team.id); else await teams.leave(team.id); await reload(); });
      } }, team.role === 'owner' ? 'Delete team' : 'Leave team')));
}

// ---------- admin ----------
function Stat({ label, value }) {
  return h('div', { className: 'min-w-0' },
    h('dt', { className: 'text-sm text-muted-foreground' }, label),
    h('dd', { className: 'mt-1 font-display text-2xl font-semibold tabular-nums text-foreground' }, value == null ? '—' : Number(value).toLocaleString()));
}
export function AdminPage({ title = 'Admin', plans = [] }) {
  const { user, ready } = useUser();
  const [data, setData] = useState(null), [denied, setDenied] = useState(false), [q, setQ] = useState(''), [giving, setGiving] = useState(null), [amount, setAmount] = useState('50'), [note, setNote] = useState(''), [done, setDone] = useState('');
  const act = useAction();
  // The server decides who is a manager; the page just asks.
  const load = useCallback((search) => act.run(async () => {
    try { setData(await admin.overview({ q: search || undefined })); } catch (e) { if (e.status === 403) setDenied(true); else throw e; }
  }), []);
  useEffect(() => { if (user) load(''); }, [user && user.id]);
  if (!ready) return h(Loading);
  if (!user) return h(SignedOut);
  if (denied) return h('p', { className: 'py-6 text-sm text-muted-foreground' }, 'This page is for the app’s managers.');
  if (!data) return act.error ? h(Notice, { tone: 'error' }, act.error) : h(Loading);
  const s = data.stats;
  return h('div', { className: 'mx-auto w-full max-w-5xl text-foreground' },
    h('h1', { className: 'mb-8 font-display text-3xl font-semibold tracking-tight' }, title),
    h('dl', { className: 'grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pb-2 pt-6 sm:grid-cols-3 lg:grid-cols-5' },
      h(Stat, { label: 'Customers', value: s.users }),
      h(Stat, { label: 'New in 30 days', value: s.new_this_month }),
      h(Stat, { label: 'Paying', value: s.paying }),
      h(Stat, { label: 'Subscriptions', value: s.subscriptions }),
      data.credits_on ? h(Stat, { label: 'Credits used, 30 days', value: s.credits_used_this_month }) : h(Stat, { label: 'Teams', value: s.teams })),
    h('div', { className: 'mt-6' }, h(Notice, { tone: 'error' }, act.error), done ? h(Notice, null, done) : null),
    h(Section, {
      title: 'Customers',
      action: h('form', { role: 'search', className: 'flex gap-2', onSubmit: (e) => { e.preventDefault(); load(q); } },
        h('label', { className: 'sr-only', htmlFor: 'kq-admin-q' }, 'Search customers'),
        h('input', { id: 'kq-admin-q', type: 'search', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Search email or name', className: 'w-56 rounded-md border border-input bg-background px-3 py-2 text-sm' }),
        h(Button, { kind: 'secondary', type: 'submit', disabled: act.busy }, 'Search'))
    },
      data.users.length === 0 ? h('p', { className: 'text-sm text-muted-foreground' }, q ? 'No customers match.' : 'No customers yet. They appear here when they sign up.') :
      h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full min-w-[640px] text-left text-sm' },
        h('thead', null, h('tr', { className: 'text-muted-foreground' },
          h('th', { scope: 'col', className: 'pb-2 pr-4 font-medium' }, 'Customer'),
          h('th', { scope: 'col', className: 'pb-2 pr-4 font-medium' }, 'Joined'),
          h('th', { scope: 'col', className: 'pb-2 pr-4 font-medium' }, 'Plan'),
          data.credits_on ? h('th', { scope: 'col', className: 'pb-2 pr-4 text-right font-medium' }, 'Credits') : null,
          data.credits_on ? h('th', { scope: 'col', className: 'pb-2' }, h('span', { className: 'sr-only' }, 'Actions')) : null)),
        h('tbody', null, data.users.map((u) => h(React.Fragment, { key: u.id },
          h('tr', { className: 'border-t border-border align-top' },
            h('td', { className: 'py-3 pr-4' }, h('p', { className: 'font-medium' }, u.name || u.email), u.name ? h('p', { className: 'text-muted-foreground' }, u.email) : null),
            h('td', { className: 'py-3 pr-4 text-muted-foreground' }, when(u.joined)),
            h('td', { className: 'py-3 pr-4' }, u.plans.length ? u.plans.map((p) => nameOf(p, plans)).join(', ') : h('span', { className: 'text-muted-foreground' }, 'Free')),
            data.credits_on ? h('td', { className: 'py-3 pr-4 text-right tabular-nums' }, (u.credits || 0).toLocaleString()) : null,
            data.credits_on ? h('td', { className: 'py-3 text-right' }, h(Button, { kind: 'secondary', className: 'px-2.5 py-1 text-xs', onClick: () => { setGiving(giving === u.id ? null : u.id); setDone(''); } }, 'Give credits')) : null),
          giving === u.id ? h('tr', null, h('td', { colSpan: 5, className: 'pb-4' },
            h('form', { className: 'flex flex-wrap items-end gap-2 rounded-lg bg-muted p-3', onSubmit: (e) => { e.preventDefault(); act.run(async () => { const r = await admin.giveCredits(u.id, Number(amount), note); setGiving(null); setNote(''); setDone('Gave ' + Number(amount).toLocaleString() + ' credits to ' + u.email + '. New balance: ' + r.balance.toLocaleString() + '.'); await load(q); }); } },
              h('label', { className: 'text-sm' }, 'Credits', h('input', { type: 'number', min: 1, step: 1, required: true, value: amount, onChange: (e) => setAmount(e.target.value), className: 'ml-2 w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm' })),
              h('label', { className: 'min-w-0 flex-1 text-sm' }, 'Note', h('input', { value: note, maxLength: 120, onChange: (e) => setNote(e.target.value), placeholder: 'Why (the customer sees this)', className: 'ml-2 w-full max-w-sm rounded-md border border-input bg-background px-2 py-1.5 text-sm' })),
              h(Button, { type: 'submit', disabled: act.busy }, 'Give')))) : null)))),
      data.more ? h('p', { className: 'mt-3 text-sm text-muted-foreground' }, 'Showing the newest 200. Search to find someone else.') : null)),
    data.payments.length ? h(Section, { title: 'Recent payments' },
      h('ul', { className: 'divide-y divide-border text-sm' }, data.payments.map((p, i) => h('li', { key: i, className: 'flex flex-wrap justify-between gap-3 py-2.5' },
        h('span', null, (p.email || 'Deleted customer') + ' · ' + nameOf(p.product, plans)),
        h('span', { className: 'tabular-nums text-muted-foreground' }, [money(p.amount, p.currency), p.status === 'active' ? '' : p.status, when(p.created_at)].filter(Boolean).join(' · ')))))) : null);
}

export default { BillingPage, TeamPage, AdminPage, TeamSwitcher, CreditsBadge, refreshCredits };
