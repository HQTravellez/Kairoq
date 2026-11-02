// Copilot tool: find contacts by name, company or email, with their open deals and tasks.
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const q = String(request.body?.query || '').trim().toLowerCase().slice(0, 80);
  const [contacts, deals, tasks] = await Promise.all([db.collection('contacts').list({ limit: 500 }), db.collection('deals').list({ limit: 500 }), db.collection('tasks').list({ limit: 500 })]);
  const hits = contacts.filter(c => !q || [c.name, c.company, c.email].some(v => String(v || '').toLowerCase().includes(q))).slice(0, 8);
  return { status: 200, json: { contacts: hits.map(c => ({
    id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, status: c.status,
    deals: deals.filter(d => d.contact_id === c.id && !['Won', 'Lost'].includes(d.stage)).map(d => ({ id: d.id, title: d.title, stage: d.stage, value: d.value, last_activity_at: d.last_activity_at })),
    open_tasks: tasks.filter(t => t.contact_id === c.id && !t.done).map(t => ({ title: t.title, due: t.due }))
  })) } };
}
