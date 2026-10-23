import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, functions } from 'kairoq';
import { toast } from 'sonner';
import AuthPanel from '../components/AuthPanel.jsx';
import Photo from '../components/Photo.jsx';
import { euro, niceDate } from '../lib/hotel.js';

export default function Stays() {
  const [user, setUser] = useState(auth.user());
  const [stays, setStays] = useState(null);
  useEffect(() => auth.onChange(setUser), []);
  useEffect(() => { if (user) load(); else setStays(null); }, [user]);
  async function load(cancel) {
    try { setStays((await functions.invoke('my-stays', cancel ? { cancel } : {})).stays); if (cancel) toast.success('Your booking was cancelled.'); }
    catch (err) { toast.error(err.message); }
  }
  if (!user) return <div className="px-5 py-16"><AuthPanel title="Your stays" intro="Sign in to see and manage your bookings." /></div>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-5xl text-[#12345c]">Your stays</h1>
        <button type="button" onClick={() => auth.signOut()} className="text-sm text-slate-500 hover:underline">Sign out {user.email}</button>
      </div>
      {stays === null ? <p className="mt-8 text-slate-500">Loading…</p> : stays.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-slate-600">No stays yet.</p>
          <Link to="/book" className="mt-4 inline-block rounded-full bg-[#c4683f] px-6 py-3 font-medium text-white">Book a stay</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {stays.map((s) => (
            <li key={s.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 sm:flex-row">
              <Photo src={s.image} alt={s.room} className="h-40 sm:h-auto sm:w-48" />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <p className="font-display text-2xl text-[#12345c]">{s.room}</p>
                  <p className="text-sm text-slate-600">{niceDate(s.check_in)} – {niceDate(s.check_out)} · {s.guests} guest{s.guests > 1 ? 's' : ''} · {euro(s.total)}</p>
                  <p className={'mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-medium ' + (s.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700')}>Booking #{s.id} · {s.status}</p>
                </div>
                {s.status === 'confirmed' && s.check_in > today && <button type="button" onClick={() => { if (confirm('Cancel this booking?')) load(s.id); }} className="rounded-full px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50">Cancel</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
