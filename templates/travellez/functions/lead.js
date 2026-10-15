// "Talk to sales" form on the Pricing page. Saved for the Travellez team; nothing is faked.
// Public on purpose (visitors are not signed in), so it is guarded against spam: a hidden
// honeypot field bots fill in, and one request per email address a day.
export default async function (request, { db }) {
  if (request.method !== 'POST') return { status: 405, json: { error: 'Use POST' } };
  const b = request.body || {};
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  const name = t(b.name, 100), email = t(b.email, 200).toLowerCase(), company = t(b.company, 120), size = t(b.team_size, 20), message = t(b.message, 1500);
  if (b.website) return { status: 201, json: { id: 0 } };
  if (!name || !company) return { status: 400, json: { error: 'Please add your name and company.' } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, json: { error: 'Please enter a valid work email.' } };
  if (!['1-10', '11-50', '51-200', '201-1000', '1000+'].includes(size)) return { status: 400, json: { error: 'Please choose your team size.' } };
  const [recent] = await db.sql`SELECT COUNT(*) AS n FROM leads WHERE email = ${email} AND created_at > datetime('now', '-1 day')`;
  if (recent.n) return { status: 429, json: { error: 'We already have your request from today. We will be in touch soon.' } };
  const [row] = await db.sql`INSERT INTO leads (name, email, company, team_size, message) VALUES (${name}, ${email}, ${company}, ${size}, ${message || null}) RETURNING id`;
  console.log('lead', row.id, company, size);
  return { status: 201, json: { id: row.id } };
}
