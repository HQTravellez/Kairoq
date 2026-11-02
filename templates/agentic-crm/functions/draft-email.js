// Copilot tool (needs the user's Confirm): write a follow-up email draft for the team to review.
// Nothing is sent: drafts wait in the Drafts list until someone sends or copies them.
export default async function (request, { user, db, ai }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const b = request.body || {};
  const q = String(b.contact || '').trim().toLowerCase();
  const contact = (await db.collection('contacts').list({ limit: 500 })).find(c => c.id === b.contact || String(c.name || '').toLowerCase().includes(q) || String(c.company || '').toLowerCase() === q);
  if (!contact) return { status: 404, json: { error: 'No contact matches "' + String(b.contact || '').slice(0, 60) + '".' } };
  const purpose = String(b.purpose || 'a friendly follow-up').slice(0, 300);
  let subject = 'Following up', body = '';
  try {
    const r = await ai.chat({ system: 'You write short, warm, specific sales follow-up emails (under 120 words, no buzzwords, one clear question at the end). Reply as JSON {"subject":"...","body":"..."}.', messages: [{ role: 'user', content: 'To: ' + contact.name + ' at ' + (contact.company || 'their company') + '. Notes: ' + (contact.notes || 'none') + '. Purpose: ' + purpose }] });
    const t = String(r.text || '');
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    subject = String(j.subject || subject).slice(0, 140); body = String(j.body || '').slice(0, 2000);
  } catch { body = 'Hi ' + String(contact.name || '').split(' ')[0] + ',\n\nI wanted to follow up on ' + purpose + '. Would a quick call this week work for you?\n\nBest,'; }
  const draft = await db.collection('drafts').create({ to: contact.email || '', contact_id: contact.id, contact_name: contact.name, subject, body, status: 'draft', by: 'copilot', at: new Date().toISOString() });
  await db.collection('activity').create({ at: draft.at, type: 'draft', by: 'copilot', text: 'Copilot drafted an email to ' + contact.name + ': ' + subject, contact_id: contact.id });
  return { status: 201, json: { draft } };
}
