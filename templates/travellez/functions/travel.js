// Travellez workspace API. Every signed-in account is its own company workspace.
// The workflow is enforced here, in SQL: a trip can be approved only while requested,
// booked only once approved; an expense can be submitted only from draft and paid only
// once submitted.
const CATEGORIES = ['flight', 'hotel', 'ground', 'meals', 'other'];
const iso = /^\d{4}-\d{2}-\d{2}$/;
const bad = (error, status = 400) => ({ status, json: { error } });
const text = (v, n) => String(v ?? '').trim().slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => Math.round((Date.parse(d) - Date.parse(today())) / 86400000);

async function policy(db, owner) {
  const [p] = await db.sql`SELECT currency, trip_cap, hotel_night_cap, advance_days, require_approval_above FROM policies WHERE owner_id = ${owner}`;
  return p || { currency: 'EUR', trip_cap: 1500, hotel_night_cap: 180, advance_days: 7, require_approval_above: 0 };
}

async function load(db, owner) {
  const travelers = await db.sql`SELECT id, name, email, department, status, created_at FROM travelers WHERE owner_id = ${owner} ORDER BY name`;
  const trips = await db.sql`
    SELECT t.id, t.traveler_id, v.name AS traveler, t.origin, t.destination, t.departure_date, t.return_date, t.purpose,
      t.estimate, t.status, t.over_policy, t.created_at,
      (SELECT a.id FROM approvals a WHERE a.trip_id = t.id ORDER BY a.id DESC LIMIT 1) AS approval_id,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.trip_id = t.id) AS spent
    FROM trips t JOIN travelers v ON v.id = t.traveler_id
    WHERE t.owner_id = ${owner} ORDER BY t.departure_date DESC, t.id DESC`;
  const approvals = await db.sql`
    SELECT a.id, a.trip_id, a.status, a.note, a.decided_at, a.created_at, v.name AS requester,
      t.destination, t.departure_date, t.return_date, t.estimate, t.purpose, t.over_policy
    FROM approvals a JOIN trips t ON t.id = a.trip_id JOIN travelers v ON v.id = t.traveler_id
    WHERE a.owner_id = ${owner} ORDER BY (a.status = 'pending') DESC, a.id DESC`;
  const expenses = await db.sql`
    SELECT e.id, e.trip_id, t.destination, v.name AS traveler, e.description, e.amount, e.category, e.status, e.created_at
    FROM expenses e JOIN trips t ON t.id = e.trip_id JOIN travelers v ON v.id = t.traveler_id
    WHERE e.owner_id = ${owner} ORDER BY e.id DESC`;
  const month = today().slice(0, 7);
  const stats = {
    requested: trips.filter((t) => t.status === 'requested').length,
    approved: trips.filter((t) => t.status === 'approved').length,
    booked: trips.filter((t) => t.status === 'booked').length,
    pending_approvals: approvals.filter((a) => a.status === 'pending').length,
    active_travelers: travelers.filter((t) => t.status === 'active').length,
    spend_month: expenses.filter((e) => e.created_at.slice(0, 7) === month).reduce((n, e) => n + e.amount, 0),
    spend_total: expenses.reduce((n, e) => n + e.amount, 0),
    to_pay: expenses.filter((e) => e.status === 'submitted').reduce((n, e) => n + e.amount, 0),
    by_category: CATEGORIES.map((c) => ({ category: c, amount: expenses.filter((e) => e.category === c).reduce((n, e) => n + e.amount, 0) }))
  };
  return { travelers, trips, approvals, expenses, policy: await policy(db, owner), stats };
}

async function createTrip(db, owner, b) {
  const travelerId = Number(b.traveler_id), estimate = Math.round(Number(b.estimate));
  const origin = text(b.origin, 80), destination = text(b.destination, 80), purpose = text(b.purpose, 300);
  if (!Number.isInteger(travelerId)) return bad('Choose who is travelling.');
  if (!origin || !destination) return bad('Enter where the trip starts and where it goes.');
  if (!iso.test(String(b.departure_date)) || !iso.test(String(b.return_date)) || b.return_date < b.departure_date) return bad('Choose valid travel dates.');
  if (b.departure_date < today()) return bad('The departure date cannot be in the past.');
  if (!purpose) return bad('Add the business purpose of the trip.');
  if (!Number.isInteger(estimate) || estimate < 0 || estimate > 1000000) return bad('Enter an estimated cost.');
  const [traveler] = await db.sql`SELECT id, status FROM travelers WHERE id = ${travelerId} AND owner_id = ${owner}`;
  if (!traveler) return bad('That traveler is not in your workspace.');
  if (traveler.status !== 'active') return bad('That traveler is inactive. Reactivate them first.');
  const p = await policy(db, owner);
  const reasons = [];
  if (estimate > p.trip_cap) reasons.push('above the ' + p.trip_cap + ' ' + p.currency + ' trip cap');
  if (daysUntil(b.departure_date) < p.advance_days) reasons.push('booked less than ' + p.advance_days + ' days ahead');
  const auto = !reasons.length && p.require_approval_above > 0 && estimate <= p.require_approval_above;
  const [trip] = await db.sql`
    INSERT INTO trips (owner_id, traveler_id, origin, destination, departure_date, return_date, purpose, estimate, status, over_policy)
    VALUES (${owner}, ${travelerId}, ${origin}, ${destination}, ${b.departure_date}, ${b.return_date}, ${purpose}, ${estimate}, ${auto ? 'approved' : 'requested'}, ${reasons.length ? 1 : 0})
    RETURNING id`;
  await db.sql`
    INSERT INTO approvals (owner_id, trip_id, status, note, decided_at)
    VALUES (${owner}, ${trip.id}, ${auto ? 'approved' : 'pending'}, ${auto ? 'Approved automatically: within policy and under ' + p.require_approval_above + ' ' + p.currency : reasons.length ? 'Outside policy: ' + reasons.join(', ') : null}, ${auto ? new Date().toISOString() : null})`;
  return { status: 201, json: { id: trip.id, status: auto ? 'approved' : 'requested', over_policy: reasons } };
}

async function decide(db, owner, b) {
  const decision = b.decision === 'approved' ? 'approved' : b.decision === 'rejected' ? 'rejected' : null;
  if (!decision) return bad('Choose approve or reject.');
  const note = text(b.note, 300) || null;
  const rows = await db.sql`
    UPDATE approvals SET status = ${decision}, note = COALESCE(${note}, note), decided_at = ${new Date().toISOString()}
    WHERE id = ${Number(b.approval_id)} AND owner_id = ${owner} AND status = 'pending'
    RETURNING trip_id`;
  if (!rows.length) return bad('This approval was already decided.', 409);
  const moved = await db.sql`UPDATE trips SET status = ${decision} WHERE id = ${rows[0].trip_id} AND owner_id = ${owner} AND status = 'requested' RETURNING id`;
  if (!moved.length) return bad('The trip is no longer waiting for approval.', 409);
  return { json: { trip_id: rows[0].trip_id, status: decision } };
}

async function move(db, owner, table, id, from, to, message) {
  const rows = table === 'trips'
    ? await db.sql`UPDATE trips SET status = ${to} WHERE id = ${Number(id)} AND owner_id = ${owner} AND status IN (SELECT value FROM json_each(${JSON.stringify(from)})) RETURNING id`
    : await db.sql`UPDATE expenses SET status = ${to} WHERE id = ${Number(id)} AND owner_id = ${owner} AND status IN (SELECT value FROM json_each(${JSON.stringify(from)})) RETURNING id`;
  return rows.length ? { json: { id: rows[0].id, status: to } } : bad(message, 409);
}

async function addExpense(db, owner, b) {
  const amount = Math.round(Number(b.amount)), description = text(b.description, 200);
  if (!description) return bad('Describe the expense.');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000) return bad('Enter an amount above zero.');
  if (!CATEGORIES.includes(b.category)) return bad('Choose a category.');
  const [trip] = await db.sql`SELECT id, status FROM trips WHERE id = ${Number(b.trip_id)} AND owner_id = ${owner}`;
  if (!trip) return bad('Choose one of your trips.');
  if (!['approved', 'booked'].includes(trip.status)) return bad('Expenses can be added to approved or booked trips only.');
  const [row] = await db.sql`INSERT INTO expenses (owner_id, trip_id, description, amount, category) VALUES (${owner}, ${trip.id}, ${description}, ${amount}, ${b.category}) RETURNING id`;
  return { status: 201, json: { id: row.id, status: 'draft' } };
}

async function saveTraveler(db, owner, b) {
  const name = text(b.name, 100), email = text(b.email, 200).toLowerCase(), department = text(b.department, 60) || 'General';
  if (!name) return bad('Enter the traveler\'s name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Enter a valid email address.');
  if (b.id) {
    const status = b.status === 'inactive' ? 'inactive' : 'active';
    const rows = await db.sql`UPDATE travelers SET name = ${name}, email = ${email}, department = ${department}, status = ${status} WHERE id = ${Number(b.id)} AND owner_id = ${owner} RETURNING id`;
    return rows.length ? { json: { id: rows[0].id } } : bad('Traveler not found.', 404);
  }
  const [dupe] = await db.sql`SELECT id FROM travelers WHERE owner_id = ${owner} AND email = ${email}`;
  if (dupe) return bad('A traveler with this email already exists.');
  const [row] = await db.sql`INSERT INTO travelers (owner_id, name, email, department) VALUES (${owner}, ${name}, ${email}, ${department}) RETURNING id`;
  return { status: 201, json: { id: row.id } };
}

async function savePolicy(db, owner, b) {
  const n = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isInteger(x) && x >= lo && x <= hi ? x : null; };
  const p = { trip_cap: n(b.trip_cap, 0, 1000000), hotel_night_cap: n(b.hotel_night_cap, 0, 100000), advance_days: n(b.advance_days, 0, 365), require_approval_above: n(b.require_approval_above, 0, 1000000) };
  if (Object.values(p).some((v) => v === null)) return bad('Use whole numbers for every limit.');
  const currency = ['EUR', 'USD', 'GBP', 'CAD'].includes(b.currency) ? b.currency : 'EUR';
  await db.sql`
    INSERT INTO policies (owner_id, currency, trip_cap, hotel_night_cap, advance_days, require_approval_above)
    VALUES (${owner}, ${currency}, ${p.trip_cap}, ${p.hotel_night_cap}, ${p.advance_days}, ${p.require_approval_above})
    ON CONFLICT (owner_id) DO UPDATE SET currency = excluded.currency, trip_cap = excluded.trip_cap, hotel_night_cap = excluded.hotel_night_cap,
      advance_days = excluded.advance_days, require_approval_above = excluded.require_approval_above`;
  return { json: { ok: true } };
}

// Sample data for an empty workspace, so a new company can see how it works.
async function sample(db, owner) {
  const [has] = await db.sql`SELECT COUNT(*) AS n FROM travelers WHERE owner_id = ${owner}`;
  if (has.n) return bad('Sample data can only be added to an empty workspace.');
  const people = [['Amara Okafor', 'amara@example.com', 'Sales'], ['Lucas Moreau', 'lucas@example.com', 'Engineering'], ['Priya Nair', 'priya@example.com', 'Customer success'], ['Jonas Berg', 'jonas@example.com', 'Finance']];
  const ids = [];
  for (const [name, email, dept] of people) ids.push((await db.sql`INSERT INTO travelers (owner_id, name, email, department) VALUES (${owner}, ${name}, ${email}, ${dept}) RETURNING id`)[0].id);
  const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const trips = [[ids[0], 'London', 'Lisbon', day(21), day(23), 'Client workshop with a hotel group', 980, 'booked'], [ids[1], 'Berlin', 'Amsterdam', day(30), day(31), 'Partner integration kickoff', 640, 'approved'], [ids[2], 'Paris', 'Toronto', day(45), day(49), 'Customer success summit', 2350, 'requested']];
  for (const [tv, from, to, dep, ret, purpose, est, status] of trips) {
    const over = est > 1500 ? 1 : 0;
    const [t] = await db.sql`INSERT INTO trips (owner_id, traveler_id, origin, destination, departure_date, return_date, purpose, estimate, status, over_policy) VALUES (${owner}, ${tv}, ${from}, ${to}, ${dep}, ${ret}, ${purpose}, ${est}, ${status}, ${over}) RETURNING id`;
    await db.sql`INSERT INTO approvals (owner_id, trip_id, status, note, decided_at) VALUES (${owner}, ${t.id}, ${status === 'requested' ? 'pending' : 'approved'}, ${over ? 'Outside policy: above the 1500 EUR trip cap' : null}, ${status === 'requested' ? null : new Date().toISOString()})`;
    if (status === 'booked') {
      await db.sql`INSERT INTO expenses (owner_id, trip_id, description, amount, category, status) VALUES (${owner}, ${t.id}, 'Return flight LHR–LIS', 286, 'flight', 'paid')`;
      await db.sql`INSERT INTO expenses (owner_id, trip_id, description, amount, category, status) VALUES (${owner}, ${t.id}, 'Hotel, 2 nights', 312, 'hotel', 'submitted')`;
      await db.sql`INSERT INTO expenses (owner_id, trip_id, description, amount, category) VALUES (${owner}, ${t.id}, 'Team dinner with client', 145, 'meals')`;
    }
  }
  return { status: 201, json: { ok: true } };
}

export default async function (request, { db, user }) {
  if (!user) return bad('Please sign in to your workspace.', 401);
  const owner = user.id, b = request.body || {};
  let out;
  switch (b.action) {
    case 'load': return { json: await load(db, owner) };
    case 'createTrip': out = await createTrip(db, owner, b); break;
    case 'decide': out = await decide(db, owner, b); break;
    case 'book': out = await move(db, owner, 'trips', b.trip_id, ['approved'], 'booked', 'Only approved trips can be booked.'); break;
    case 'cancelTrip': {
      out = await move(db, owner, 'trips', b.trip_id, ['requested', 'approved'], 'cancelled', 'Only requested or approved trips can be cancelled.');
      if (!out.status) await db.sql`UPDATE approvals SET status = 'rejected', note = 'Trip cancelled', decided_at = ${new Date().toISOString()} WHERE trip_id = ${Number(b.trip_id)} AND owner_id = ${owner} AND status = 'pending'`;
      break;
    }
    case 'addExpense': out = await addExpense(db, owner, b); break;
    case 'submitExpense': out = await move(db, owner, 'expenses', b.expense_id, ['draft'], 'submitted', 'Only draft expenses can be submitted.'); break;
    case 'payExpense': out = await move(db, owner, 'expenses', b.expense_id, ['submitted'], 'paid', 'Only submitted expenses can be marked as paid.'); break;
    case 'saveTraveler': out = await saveTraveler(db, owner, b); break;
    case 'savePolicy': out = await savePolicy(db, owner, b); break;
    case 'sample': out = await sample(db, owner); break;
    default: return bad('Unknown action.');
  }
  if (out.status >= 400) return out;
  return { status: out.status || 200, json: { ...out.json, workspace: await load(db, owner) } };
}
