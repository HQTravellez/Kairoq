// Copilot tool (needs the user's Confirm): create a follow-up task for a contact.
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const b = request.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  if (!title) return { status: 400, json: { error: 'The task needs a title.' } };
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due || '')) ? b.due : new Date().toISOString().slice(0, 10);
  const name = String(b.contact || '').trim().toLowerCase();
  const contact = name ? (await db.collection('contacts').list({ limit: 500 })).find(c => String(c.name || '').toLowerCase() === name || String(c.company || '').toLowerCase() === name || String(c.name || '').toLowerCase().includes(name)) : null;
  const task = await db.collection('tasks').create({ title, due, done: false, contact_id: contact?.id || null, contact_name: contact?.name || '', by: 'copilot' });
  await db.collection('activity').create({ at: new Date().toISOString(), type: 'task', by: 'copilot', text: 'Copilot added a task: ' + title + (contact ? ' (' + contact.name + ')' : ''), contact_id: contact?.id || null });
  return { status: 201, json: { task } };
}
