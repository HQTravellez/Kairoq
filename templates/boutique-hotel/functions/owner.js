// Hotel team dashboard. Only emails listed in the OWNER_EMAILS secret get in.
export default async function (request, { db, user, secrets }) {
  if (!user) return { status: 401, json: { error: 'Please sign in.' } };
  const allowed = String((await secrets.get('OWNER_EMAILS')) || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(String(user.email).toLowerCase())) return { status: 403, json: { error: 'This page is for the Casa Azul team.' } };
  const cancel = request.body && request.body.cancel;
  if (cancel) await db.sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${Number(cancel)}`;
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [totals] = await db.sql`
    SELECT COUNT(*) AS upcoming, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(nights), 0) AS nights
    FROM bookings WHERE status = 'confirmed' AND check_out > ${today}`;
  const occupancy = await db.sql`
    SELECT r.name AS room,
      COALESCE(SUM(MAX(0, julianday(MIN(b.check_out, ${in30})) - julianday(MAX(b.check_in, ${today})))), 0) AS nights
    FROM rooms r LEFT JOIN bookings b
      ON b.room_id = r.id AND b.status = 'confirmed' AND b.check_in < ${in30} AND b.check_out > ${today}
    GROUP BY r.id ORDER BY r.price`;
  const months = await db.sql`
    SELECT substr(check_in, 1, 7) AS month, SUM(total) AS revenue, COUNT(*) AS bookings
    FROM bookings WHERE status = 'confirmed'
    GROUP BY month ORDER BY month DESC LIMIT 6`;
  const list = await db.sql`
    SELECT b.id, b.name, b.email, b.check_in, b.check_out, b.guests, b.total, b.status, b.message, r.name AS room
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    ORDER BY b.check_in DESC LIMIT 100`;
  return { json: { totals, occupancy: occupancy.map((o) => ({ room: o.room, percent: Math.round((o.nights / 30) * 100) })), months: months.reverse(), bookings: list } };
}
