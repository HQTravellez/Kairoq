// "Book a demo" form and the savings calculator's "Send me the breakdown". Saved for the
// Travellez team; nothing is faked. Public on purpose (visitors are not signed in), so it is
// guarded against spam: a hidden honeypot field bots fill in, and one request per email a day.
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
export default async function (request, { db }) {
  if (request.method !== 'POST') return { status: 405, json: { error: 'Use POST' } };
  const b = request.body || {};
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  const kind = b.kind === 'breakdown' ? 'breakdown' : 'demo';
  const first = t(b.first_name, 60), last = t(b.last_name, 60), email = t(b.email, 200).toLowerCase(), company = t(b.company, 120);
  const size = t(b.company_size, 20), phone = t(b.phone, 40), message = t(b.message, 1500);
  if (b.website) return { status: 201, json: { id: 0 } };
  if (!company) return { status: 400, json: { error: 'Please add your company name.' } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, json: { error: 'Please enter a valid work email.' } };
  if (kind === 'demo') {
    if (!first || !last) return { status: 400, json: { error: 'Please add your first and last name.' } };
    if (!SIZES.includes(size)) return { status: 400, json: { error: 'Please choose your company size.' } };
  }
  const [recent] = await db.sql`SELECT COUNT(*) AS n FROM leads WHERE email = ${email} AND kind = ${kind} AND created_at > datetime('now', '-1 day')`;
  if (recent.n) return { status: 429, json: { error: 'We already have your request from today. We will be in touch soon.' } };
  const [row] = await db.sql`INSERT INTO leads (kind, first_name, last_name, email, company, company_size, phone, message) VALUES (${kind}, ${first || null}, ${last || null}, ${email}, ${company}, ${size || null}, ${phone || null}, ${message || null}) RETURNING id`;
  console.log('lead', kind, row.id, company, size);
  return { status: 201, json: { id: row.id } };
}
