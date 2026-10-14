import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { auth } from 'kairoq';
import Shell from './components/Shell.jsx';
import Welcome from './pages/Welcome.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Today from './pages/Today.jsx';
import Activity from './pages/Activity.jsx';
import Progress from './pages/Progress.jsx';
import Profile from './pages/Profile.jsx';
import { api } from './lib/fit.js';

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [editing, setEditing] = useState(false);
  useEffect(() => { document.title = 'Plate & Pulse · Calories, macros and workouts'; auth.ready().then(() => { setUser(auth.user()); setReady(true); }); return auth.onChange(setUser); }, []);
  const loadProfile = useCallback(() => api('profile').then((r) => setProfile(r.profile)).catch(() => setProfile(null)), []);
  useEffect(() => { if (user) { setProfile(undefined); loadProfile(); } }, [user, loadProfile]);

  let screen;
  if (!ready || (user && profile === undefined)) screen = <div className="flex min-h-screen items-center justify-center"><span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#0c1222]" aria-label="Loading" /></div>;
  else if (!user) screen = <Welcome />;
  else if (!profile || editing) screen = <Onboarding initial={profile || undefined} onDone={() => { setEditing(false); loadProfile(); }} />;
  else screen = (
    <Shell>
      <Routes>
        <Route path="/" element={<Today profile={profile} user={user} />} />
        <Route path="/activity" element={<Activity profile={profile} />} />
        <Route path="/progress" element={<Progress profile={profile} onProfileChange={loadProfile} />} />
        <Route path="/profile" element={<Profile profile={profile} user={user} onEdit={() => setEditing(true)} />} />
        <Route path="*" element={<Today profile={profile} user={user} />} />
      </Routes>
    </Shell>
  );
  return <HashRouter>{screen}<Toaster position="top-center" toastOptions={{ style: { borderRadius: 16, fontFamily: 'Plus Jakarta Sans' } }} /></HashRouter>;
}
