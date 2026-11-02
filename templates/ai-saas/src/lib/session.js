import { useEffect, useState } from 'react';
import { auth, teams } from 'kairoq';

// The signed-in user (null when signed out), once sign-in has finished loading.
export function useSession() {
  const [user, setUser] = useState(auth.user());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    auth.ready().then(() => { if (live) { setUser(auth.user()); setReady(true); } });
    const off = auth.onChange(setUser);
    return () => { live = false; off(); };
  }, []);
  return { user, ready };
}

// The user's teams and the current one. A saved team the user has left is dropped.
export function useTeam(user) {
  const [list, setList] = useState(null);
  const [current, setCurrent] = useState(teams.current());
  useEffect(() => teams.onChange(setCurrent), []);
  useEffect(() => {
    if (!user) { setList(null); return; }
    let live = true;
    teams.list().then((all) => {
      if (!live) return;
      setList(all);
      if (!all.some((t) => t.id === teams.current())) teams.use(all[0] ? all[0].id : null);
    }).catch(() => live && setList([]));
    return () => { live = false; };
  }, [user && user.id, current]);
  const team = (list || []).find((t) => t.id === current) || null;
  return { teams: list, team, loading: user && !list };
}
