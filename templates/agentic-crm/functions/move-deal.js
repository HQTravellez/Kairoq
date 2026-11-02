// Copilot tool (needs the user's Confirm): move a deal to another stage.
const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const b = request.body || {};
  const stage = STAGES.find(s => s.toLowerCase() === String(b.stage || '').trim().toLowerCase());
  if (!stage) return { status: 400, json: { error: 'Stage must be one of ' + STAGES.join(', ') } };
  const q = String(b.deal || '').trim().toLowerCase();
  const deal = (await db.collection('deals').list({ limit: 500 })).find(d => d.id === b.deal || String(d.title || '').toLowerCase().includes(q) || String(d.company || '').toLowerCase() === q);
  if (!deal) return { status: 404, json: { error: 'No deal matches "' + String(b.deal || '').slice(0, 60) + '".' } };
  const now = new Date().toISOString();
  const updated = await db.collection('deals').update(deal.id, { stage, last_activity_at: now });
  await db.collection('activity').create({ at: now, type: 'stage', by: 'copilot', text: 'Copilot moved ' + deal.title + ' from ' + deal.stage + ' to ' + stage, deal_id: deal.id, contact_id: deal.contact_id || null });
  return { status: 200, json: { deal: updated } };
}
