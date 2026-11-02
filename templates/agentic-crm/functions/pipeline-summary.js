// Copilot tool: open pipeline by stage, plus deals that have gone quiet.
const OPEN = ['Lead', 'Qualified', 'Proposal', 'Negotiation'];
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const deals = await db.collection('deals').list({ limit: 500 });
  const week = Date.now() - 7 * 86400000;
  const by = OPEN.map(stage => { const d = deals.filter(x => x.stage === stage); return { stage, count: d.length, value: d.reduce((n, x) => n + Number(x.value || 0), 0) }; });
  const quiet = deals.filter(d => OPEN.includes(d.stage) && Date.parse(d.last_activity_at || d._updated_at || 0) < week)
    .map(d => ({ id: d.id, title: d.title, company: d.company, stage: d.stage, value: d.value, days_quiet: Math.floor((Date.now() - Date.parse(d.last_activity_at || d._updated_at)) / 86400000) }));
  const won = deals.filter(d => d.stage === 'Won');
  return { status: 200, json: { open_value: by.reduce((n, s) => n + s.value, 0), by_stage: by, quiet_deals: quiet, won_count: won.length, won_value: won.reduce((n, d) => n + Number(d.value || 0), 0) } };
}
