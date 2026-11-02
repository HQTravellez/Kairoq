import { useEffect, useState } from 'react';
import { collection, functions } from 'kairoq';

export const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const OPEN = STAGES.slice(0, 4);
export const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
export const today = () => new Date().toISOString().slice(0, 10);
export const ago = (iso) => {
  const d = Math.floor((Date.now() - Date.parse(iso || 0)) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
};

// Records of one collection. They refresh after every change made in this app (yours, Copilot's or
// the agent's run started here) and every 30 seconds for teammates' changes. Polling instead of six
// live connections keeps the browser's connection limit free for the app's own requests.
const CHANGED = 'crm:changed';
export const changed = () => window.dispatchEvent(new Event(CHANGED));
export function useRecords(name) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = collection(name);
    let alive = true;
    const load = () => c.list({ limit: 500 }).then((x) => alive && setItems(x)).catch((e) => alive && setError(e.message));
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener(CHANGED, load);
    window.addEventListener('focus', load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener(CHANGED, load); window.removeEventListener('focus', load); };
  }, [name]);
  return [items, setItems, error];
}
// Every write goes through here so the screens refresh right after it.
const tracked = (c) => ({
  list: (o) => c.list(o), get: (id) => c.get(id),
  create: async (d) => { const r = await c.create(d); changed(); return r; },
  update: async (id, d) => { const r = await c.update(id, d); changed(); return r; },
  remove: async (id) => { await c.remove(id); changed(); }
});
export const db = {
  contacts: tracked(collection('contacts')), deals: tracked(collection('deals')), tasks: tracked(collection('tasks')),
  activity: tracked(collection('activity')), drafts: tracked(collection('drafts')), runs: tracked(collection('agent_runs'))
};
export async function invoke(name, body) {
  const r = await functions.invoke(name, body);
  changed();
  return r;
}
export async function log(text, extra = {}) {
  return db.activity.create({ at: new Date().toISOString(), type: 'note', by: 'you', text, ...extra });
}
