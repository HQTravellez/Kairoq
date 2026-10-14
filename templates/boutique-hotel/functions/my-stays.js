// The signed-in guest's bookings; guests can cancel their own future stays.
export default async function (request, { db, user }) {
  if (!user) return { status: 401, json: { error: 'Please sign in to see your stays.' } };
  const cancel = request.body && request.body.cancel;
  if (cancel) {
    const today = new Date().toISOString().slice(0, 10);
    const r = await db.sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${Number(cancel)} AND user_id = ${user.id} AND status = 'confirmed' AND check_in > ${today}`;
    if (!r.changes) return { status: 400, json: { error: 'This stay can no longer be cancelled online. Please write to us.' } };
  }
  const stays = await db.sql`
    SELECT b.id, b.check_in, b.check_out, b.nights, b.guests, b.total, b.status, r.name AS room, r.image
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    WHERE b.user_id = ${user.id} ORDER BY b.check_in DESC`;
  return { json: { stays } };
}
