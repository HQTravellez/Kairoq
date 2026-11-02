// The agent's daily run (automation every morning, or "Run now" in the Agent page).
// It adds follow-up tasks for deals that have gone quiet and for new leads nobody has called,
// never twice for the same thing, logs each action with its reason, and writes a short summary.
// It only creates tasks and notes: nothing is emailed, charged or deleted.
const OPEN = ['Lead', 'Qualified', 'Proposal', 'Negotiation'];
const money = (n) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export default async function (request, { user, db, ai }) {
  const now = new Date(), iso = now.toISOString(), today = iso.slice(0, 10);
  // Without a signed-in user this is the daily automation; it runs at most once every 20 hours, so a
  // stranger calling the function's address cannot make it run again and again.
  if (!user) {
    const last = (await db.collection('agent_runs').list({ limit: 1 }))[0];
    if (last && now - Date.parse(last.at) < 20 * 3600000) return { status: 429, json: { error: 'The agent already ran today.' } };
  }
  const [deals, contacts, tasks] = await Promise.all([db.collection('deals').list({ limit: 500 }), db.collection('contacts').list({ limit: 500 }), db.collection('tasks').list({ limit: 500 })]);
  const open = tasks.filter(t => !t.done);
  const actions = [];
  for (const d of deals.filter(d => OPEN.includes(d.stage))) {
    const quiet = Math.floor((now - Date.parse(d.last_activity_at || d._updated_at)) / 86400000);
    if (quiet < 7 || open.some(t => t.deal_id === d.id) || actions.length >= 20) continue;
    const title = 'Follow up on ' + d.title + ' (' + d.stage + ', quiet ' + quiet + ' days)';
    await db.collection('tasks').create({ title, due: today, done: false, deal_id: d.id, contact_id: d.contact_id || null, contact_name: d.company || '', by: 'agent' });
    actions.push({ kind: 'task', text: title, why: 'No activity for ' + quiet + ' days in ' + d.stage, deal_id: d.id });
  }
  for (const c of contacts.filter(c => c.status === 'New')) {
    const age = Math.floor((now - Date.parse(c._created_at)) / 86400000);
    if (age < 1 || open.some(t => t.contact_id === c.id) || actions.length >= 20) continue;
    const title = 'Qualify new lead: ' + c.name + (c.company ? ' at ' + c.company : '');
    await db.collection('tasks').create({ title, due: today, done: false, contact_id: c.id, contact_name: c.name, by: 'agent' });
    actions.push({ kind: 'task', text: title, why: 'New lead for ' + age + ' day' + (age === 1 ? '' : 's') + ' with no task', contact_id: c.id });
  }
  for (const a of actions) await db.collection('activity').create({ at: iso, type: 'task', by: 'agent', text: 'Agent added a task: ' + a.text, deal_id: a.deal_id || null, contact_id: a.contact_id || null });
  const openValue = deals.filter(d => OPEN.includes(d.stage)).reduce((n, d) => n + Number(d.value || 0), 0);
  let summary = actions.length ? 'Added ' + actions.length + ' follow-up task' + (actions.length === 1 ? '' : 's') + '. Open pipeline: ' + money(openValue) + '.' : 'Nothing needed today. Open pipeline: ' + money(openValue) + '.';
  if (actions.length && ai) {
    try { const r = await ai.chat({ system: 'Write a two-sentence morning briefing for a small sales team. Plain words, no hype.', messages: [{ role: 'user', content: 'Open pipeline $' + openValue + '. Actions: ' + actions.map(a => a.text + ' because ' + a.why).join('; ') }] }); if (r.text) summary = String(r.text).slice(0, 600); } catch {}
  }
  const run = await db.collection('agent_runs').create({ at: iso, kind: user ? 'manual' : 'scheduled', summary, actions });
  return { status: 200, json: { run } };
}
