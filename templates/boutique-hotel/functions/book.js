// Books a room. The insert only succeeds when no confirmed booking overlaps, so two
// guests can never get the same room for the same nights.
export default async function (request, { db, user, email }) {
  if (request.method !== 'POST') return { status: 405, json: { error: 'Use POST' } };
  const b = request.body || {};
  const name = String(b.name || '').trim().slice(0, 100);
  const mail = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 1000);
  const roomId = Number(b.room_id), guests = Number(b.guests);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!name) return { status: 400, json: { error: 'Please enter your name.' } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { status: 400, json: { error: 'Please enter a valid email address.' } };
  if (!iso.test(String(b.check_in)) || !iso.test(String(b.check_out)) || b.check_out <= b.check_in) return { status: 400, json: { error: 'Please choose valid dates.' } };
  if (b.check_in < new Date().toISOString().slice(0, 10)) return { status: 400, json: { error: 'Check-in cannot be in the past.' } };
  const nights = Math.round((Date.parse(b.check_out) - Date.parse(b.check_in)) / 86400000);
  if (nights > 30) return { status: 400, json: { error: 'For stays longer than 30 nights, please write to us.' } };
  if (!Number.isInteger(roomId) || !Number.isInteger(guests) || guests < 1) return { status: 400, json: { error: 'Please choose a room and the number of guests.' } };

  const rows = await db.sql`
    INSERT INTO bookings (room_id, user_id, name, email, check_in, check_out, guests, nights, total, message)
    SELECT r.id, ${user ? user.id : null}, ${name}, ${mail}, ${b.check_in}, ${b.check_out}, ${guests}, ${nights}, r.price * ${nights}, ${message || null}
    FROM rooms r
    WHERE r.id = ${roomId} AND r.max_guests >= ${guests}
      AND NOT EXISTS (
        SELECT 1 FROM bookings x
        WHERE x.room_id = r.id AND x.status = 'confirmed'
          AND x.check_in < ${b.check_out} AND x.check_out > ${b.check_in}
      )
    RETURNING id, total, nights`;
  if (!rows.length) return { status: 409, json: { error: 'Sorry, that room was just booked for some of these nights. Please pick other dates or another room.' } };
  const booking = rows[0];
  const [room] = await db.sql`SELECT name FROM rooms WHERE id = ${roomId}`;
  console.log('booking', booking.id, room.name, b.check_in, '→', b.check_out);
  try {
    await email.send({ to: 'owner', subject: 'New booking #' + booking.id + ': ' + room.name, text: name + ' (' + mail + ') booked the ' + room.name + ' from ' + b.check_in + ' to ' + b.check_out + ' for ' + guests + ' guest(s). Total ' + booking.total + ' EUR.' + (message ? '\n\nMessage: ' + message : '') });
  } catch (e) { console.log('owner email not sent:', e.message); }
  return { status: 201, json: { id: booking.id, room: room.name, nights: booking.nights, total: booking.total } };
}
