import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { functions, auth } from 'kairoq';
import { toast } from 'sonner';
import { CheckCircle2, CalendarDays, Loader2 } from 'lucide-react';
import Photo from '../components/Photo.jsx';
import { Field } from '../components/AuthPanel.jsx';
import { euro, isoDay, niceDate } from '../lib/hotel.js';

export default function Book() {
  const [params] = useSearchParams();
  const [stay, setStay] = useState({ check_in: isoDay(14), check_out: isoDay(17), guests: '2' });
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [guest, setGuest] = useState({ name: '', email: '', message: '' });
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(null);
  const user = auth.user();
  useEffect(() => { if (user) setGuest((g) => ({ ...g, name: g.name || user.name || '', email: g.email || user.email })); }, [user]);

  async function check(e) {
    e && e.preventDefault();
    setChecking(true); setChosen(null);
    try {
      const r = await functions.invoke('availability', { ...stay, guests: Number(stay.guests) });
      setResult(r);
      const preferred = r.rooms.find((x) => x.slug === params.get('room') && x.free && x.fits);
      if (preferred) setChosen(preferred);
    } catch (err) { toast.error(err.message); setResult(null); }
    finally { setChecking(false); }
  }
  async function book(e) {
    e.preventDefault();
    setBooking(true);
    try {
      const r = await functions.invoke('book', { ...stay, guests: Number(stay.guests), room_id: chosen.id, ...guest });
      setDone({ ...r, ...stay });
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) check();
    } finally { setBooking(false); }
  }

  if (done) return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={56} aria-hidden="true" />
      <h1 className="font-display mt-6 text-4xl text-[#12345c]">Booking #{done.id} confirmed</h1>
      <p className="mt-4 text-lg text-slate-700">The {done.room}, {niceDate(done.check_in)} to {niceDate(done.check_out)}: {done.nights} night{done.nights === 1 ? '' : 's'}, {euro(done.total)}.</p>
      <p className="mt-2 text-slate-600">We look forward to welcoming you. Pay at the hotel; free cancellation until the day before arrival.</p>
      <div className="mt-8 flex justify-center gap-3">
        {user && <Link to="/stays" className="rounded-full bg-[#1d4e89] px-6 py-3 font-medium text-white">See my stays</Link>}
        <Link to="/" className="rounded-full bg-white px-6 py-3 font-medium text-slate-700 ring-1 ring-black/10">Back to home</Link>
      </div>
    </div>
  );

  const nights = result ? result.nights : 0;
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="font-display text-5xl text-[#12345c]">Book your stay</h1>
      <p className="mt-3 text-slate-600">Best rate guaranteed when you book with us directly. Breakfast included.</p>

      <form onSubmit={check} className="mt-8 grid gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:grid-cols-4 sm:items-end">
        <Field id="check-in" label="Check-in"><input id="check-in" type="date" required min={isoDay(0)} value={stay.check_in} onChange={(e) => setStay({ ...stay, check_in: e.target.value, check_out: e.target.value >= stay.check_out ? isoDay(Math.round((Date.parse(e.target.value) - Date.now()) / 86400000) + 2) : stay.check_out })} className="input" /></Field>
        <Field id="check-out" label="Check-out"><input id="check-out" type="date" required min={stay.check_in} value={stay.check_out} onChange={(e) => setStay({ ...stay, check_out: e.target.value })} className="input" /></Field>
        <Field id="guests" label="Guests">
          <select id="guests" value={stay.guests} onChange={(e) => setStay({ ...stay, guests: e.target.value })} className="input">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
          </select>
        </Field>
        <button disabled={checking} className="flex items-center justify-center gap-2 rounded-full bg-[#1d4e89] py-3.5 font-medium text-white transition hover:bg-[#12345c] disabled:opacity-60">
          {checking ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <CalendarDays size={18} aria-hidden="true" />} Check availability
        </button>
      </form>

      {result && (
        <section className="mt-10" aria-live="polite">
          <h2 className="text-xl font-semibold text-slate-900">{nights} night{nights === 1 ? '' : 's'}, {niceDate(stay.check_in)} to {niceDate(stay.check_out)}</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {result.rooms.map((r) => {
              const ok = r.free && r.fits, selected = chosen && chosen.id === r.id;
              return (
                <div key={r.id} className={'overflow-hidden rounded-3xl bg-white shadow-sm ring-1 transition ' + (selected ? 'ring-2 ring-[#c4683f]' : 'ring-black/5') + (ok ? '' : ' opacity-60')}>
                  <Photo src={r.image} alt={r.name} className="aspect-[16/10]" />
                  <div className="p-5">
                    <h3 className="font-display text-2xl text-[#12345c]">{r.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{euro(r.price)} / night · up to {r.max_guests} guests</p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">{euro(r.total)} total</p>
                    {ok
                      ? <button type="button" onClick={() => setChosen(r)} className={'mt-4 w-full rounded-full py-2.5 text-sm font-medium transition ' + (selected ? 'bg-[#c4683f] text-white' : 'bg-[#f6f1e8] text-slate-800 hover:bg-[#ede4d3]')}>{selected ? 'Selected' : 'Choose ' + r.name}</button>
                      : <p className="mt-4 rounded-full bg-slate-100 py-2.5 text-center text-sm text-slate-500">{r.free ? 'Too small for ' + stay.guests + ' guests' : 'Booked on these dates'}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {!result.rooms.some((r) => r.free && r.fits) && <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-amber-900">We're full for those dates. Try moving your stay by a day or two.</p>}
        </section>
      )}

      {chosen && (
        <form onSubmit={book} className="mt-10 grid gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:grid-cols-[1fr_320px] sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-xl font-semibold text-slate-900 sm:col-span-2">Your details</h2>
            <Field id="guest-name" label="Full name"><input id="guest-name" required value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="input" autoComplete="name" /></Field>
            <Field id="guest-email" label="Email"><input id="guest-email" type="email" required value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="input" autoComplete="email" /></Field>
            <div className="sm:col-span-2"><Field id="guest-message" label="Anything we should know?" hint="Arrival time, dietary needs, a special occasion…"><textarea id="guest-message" rows={3} value={guest.message} onChange={(e) => setGuest({ ...guest, message: e.target.value })} className="input" /></Field></div>
            {!user && <p className="text-sm text-slate-500 sm:col-span-2"><Link to="/stays" className="text-[#1d4e89] hover:underline">Sign in</Link> first if you want to see and manage this booking later.</p>}
          </div>
          <aside className="rounded-2xl bg-[#f6f1e8] p-6">
            <p className="font-display text-2xl text-[#12345c]">{chosen.name}</p>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><dt>Dates</dt><dd>{niceDate(stay.check_in)} – {niceDate(stay.check_out)}</dd></div>
              <div className="flex justify-between"><dt>Guests</dt><dd>{stay.guests}</dd></div>
              <div className="flex justify-between"><dt>{nights} × {euro(chosen.price)}</dt><dd>{euro(chosen.total)}</dd></div>
              <div className="flex justify-between border-t border-black/10 pt-2 text-base font-semibold text-slate-900"><dt>Total</dt><dd>{euro(chosen.total)}</dd></div>
            </dl>
            <button disabled={booking} className="mt-6 w-full rounded-full bg-[#c4683f] py-3.5 font-medium text-white transition hover:bg-[#ad5631] disabled:opacity-60">{booking ? 'Booking…' : 'Confirm booking'}</button>
            <p className="mt-3 text-center text-xs text-slate-500">Pay at the hotel · Free cancellation</p>
          </aside>
        </form>
      )}
    </div>
  );
}
