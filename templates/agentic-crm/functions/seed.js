// Adds example records once, when the CRM is empty, so the pipeline, tasks and Copilot have
// something to show. Every example is marked example: true and can be deleted.
export default async function (request, { user, db }) {
  if (!user) return { status: 401, json: { error: 'Sign in first' } };
  if ((await db.collection('contacts').list({ limit: 1 })).length) return { status: 200, json: { seeded: false } };
  const day = n => new Date(Date.now() - n * 86400000).toISOString();
  const people = [
    ['Maya Chen', 'Northwind Coffee', 'maya@example.com', 'Customer', 'Wants a loyalty app before the spring menu.'],
    ['Daniel Okafor', 'Brightline Dental', 'daniel@example.com', 'Qualified', 'Three clinics, booking is all by phone today.'],
    ['Sofia Marin', 'Marin Interiors', 'sofia@example.com', 'Qualified', 'Asked for a portfolio site with a project gallery.'],
    ['Liam Patel', 'Patel Logistics', 'liam@example.com', 'New', 'Came in through the website form.'],
    ['Ava Romero', 'Romero Fitness', 'ava@example.com', 'New', 'Met at the chamber of commerce mixer.']
  ];
  const ids = [];
  for (const [name, company, email, status, notes] of people) ids.push((await db.collection('contacts').create({ name, company, email, status, notes, example: true })).id);
  const deals = [
    ['Loyalty app', 0, 'Negotiation', 18000, 2], ['Online booking for 3 clinics', 1, 'Proposal', 24000, 9],
    ['Portfolio website', 2, 'Qualified', 6500, 12], ['Customer portal', 0, 'Won', 12000, 30], ['Class schedule app', 4, 'Lead', 4000, 1]
  ];
  for (const [title, i, stage, value, quiet] of deals) await db.collection('deals').create({ title, company: people[i][1], contact_id: ids[i], stage, value, last_activity_at: day(quiet), example: true });
  await db.collection('tasks').create({ title: 'Send revised quote to Maya', due: new Date().toISOString().slice(0, 10), done: false, contact_id: ids[0], contact_name: 'Maya Chen', by: 'you', example: true });
  await db.collection('activity').create({ at: day(2), type: 'note', by: 'you', text: 'Call with Maya: wants the app live before April.', contact_id: ids[0], example: true });
  return { status: 201, json: { seeded: true } };
}
