import { useState } from 'react';
import { auth } from 'kairoq';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';

export default function SignIn() {
  const [mode, setMode] = useState('signIn');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    setError(''); setBusy(true);
    try { mode === 'signIn' ? await auth.signIn(f.get('email'), f.get('password')) : await auth.signUp(f.get('email'), f.get('password'), f.get('name')); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-muted px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <div>
          <p className="font-display text-2xl font-semibold tracking-tight">Relay</p>
          <p className="mt-1 text-sm text-muted-foreground">Your pipeline, with an agent that follows up.</p>
        </div>
        {mode === 'signUp' && <div className="space-y-1.5"><Label htmlFor="name">Your name</Label><Input id="name" name="name" autoComplete="name" /></div>}
        <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" required type="email" name="email" autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" required type="password" name="password" minLength={8} autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy}>{busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : 'Create account'}</Button>
        <button type="button" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} className="w-full text-sm text-muted-foreground hover:text-foreground">
          {mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
