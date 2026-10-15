import { useState } from 'react';
import { auth } from 'kairoq';
import { toast } from 'sonner';

// Email sign-in and sign-up, Google sign-in and password reset in one card.
export default function AuthPanel() {
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'reset') { await auth.requestPasswordReset(form.email); toast.success('If that email has an account, a reset link is on its way.'); setMode('signin'); }
      else if (mode === 'signup') await auth.signUp(form.email, form.password, form.name);
      else await auth.signIn(form.email, form.password);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }
  async function google() { try { await auth.signInWithGoogle(); } catch (err) { toast.error(err.message); } }
  const title = mode === 'reset' ? 'Reset your password' : mode === 'signup' ? 'Create your workspace' : 'Welcome back';
  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
      <h1 className="font-display text-3xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{mode === 'signup' ? 'Free for teams up to 10 travelers. No card needed.' : mode === 'signin' ? 'Sign in to your Travellez workspace.' : 'We will email you a link.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'signup' && <Field id="auth-name" label="Your name"><input id="auth-name" value={form.name} onChange={set('name')} className="input" autoComplete="name" /></Field>}
        <Field id="auth-email" label="Work email"><input id="auth-email" type="email" required value={form.email} onChange={set('email')} className="input" autoComplete="email" /></Field>
        {mode !== 'reset' && <Field id="auth-password" label="Password"><input id="auth-password" type="password" required minLength={8} value={form.password} onChange={set('password')} className="input" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>}
        <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'One moment…' : mode === 'signup' ? 'Create workspace' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
      </form>
      {mode !== 'reset' && <button type="button" onClick={google} className="btn-ghost mt-3 w-full py-3">Continue with Google</button>}
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'I already have an account' : 'Create a workspace'}</button>
        <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode(mode === 'reset' ? 'signin' : 'reset')}>{mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}</button>
      </div>
    </div>
  );
}

export function Field({ id, label, children, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
