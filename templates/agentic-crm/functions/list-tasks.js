// Copilot tool: open tasks, soonest first.
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  const due = String(request.body?.due || 'week');
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const tasks = (await db.collection('tasks').list({ limit: 500 })).filter(t => !t.done)
    .filter(t => due === 'all' || (t.due || today) <= (due === 'today' ? today : week))
    .sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')));
  return { status: 200, json: { tasks: tasks.slice(0, 30).map(t => ({ title: t.title, due: t.due, contact: t.contact_name, by: t.by })) } };
}
