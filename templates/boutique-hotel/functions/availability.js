// Rooms that are free for the requested dates, with the price for the stay.
export default async function (request, { db }) {
  if (request.method !== 'POST') return { status: 405, json: { error: 'Use POST' } };
  const { check_in, check_out, guests } = request.body || {};
  const problem = checkStay(check_in, check_out, guests);
  if (problem) return { status: 400, json: { error: problem } };
  const nights = nightsBetween(check_in, check_out);
  const rooms = await db.sql`
    SELECT r.id, r.slug, r.name, r.tagline, r.price, r.max_guests, r.size_m2, r.image,
      NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.id AND b.status = 'confirmed'
          AND b.check_in < ${check_out} AND b.check_out > ${check_in}
      ) AS free
    FROM rooms r ORDER BY r.price`;
  return {
    json: {
      nights,
      rooms: rooms.map((r) => ({ ...r, free: Boolean(r.free), fits: r.max_guests >= Number(guests), total: r.price * nights }))
    }
  };
}

function nightsBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function checkStay(checkIn, checkOut, guests) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(String(checkIn)) || !iso.test(String(checkOut))) return 'Choose check-in and check-out dates.';
  const today = new Date().toISOString().slice(0, 10);
  if (checkIn < today) return 'Check-in cannot be in the past.';
  const nights = nightsBetween(checkIn, checkOut);
  if (!(nights >= 1)) return 'Check-out must be after check-in.';
  if (nights > 30) return 'For stays longer than 30 nights, please write to us.';
  const n = Number(guests);
  if (!Number.isInteger(n) || n < 1 || n > 4) return 'Guests must be between 1 and 4.';
  return null;
}
