import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { auth, usePageMeta } from 'kairoq';
import { PRODUCT, FREE_CREDITS } from '../saas.config.js';
import { useSession } from '../lib/session.js';

const INPUT = 'w-full rounded-md border border-input bg-background px-3 py-2.5 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20';

// Sign in, create an account, reset a forgotten password (and choose a new one from the email link).
export default function Account({ mode: start = 'signin' }) {
  const { user, ready } = useSession();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(auth.resetToken() ? 'newpassword' : start);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });
  useEffect(() => { if (!auth.resetToken()) setMode(start); }, [start]);
  usePageMeta({ title: (mode === 'signup' ? 'Create your account' : 'Sign in') + ' · ' + PRODUCT.name });

  const next = params.get('next') || '/app';
  if (ready && user && mode !== 'newpassword') return <Navigate to={next.startsWith('/') ? next : '/app'} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage({ tone: '', text: '' });
    try {
      if (mode === 'signup') await auth.signUp(form.email, form.password, form.name);
      else if (mode === 'signin') await auth.signIn(form.email, form.password);
      else if (mode === 'reset') { await auth.requestPasswordReset(form.email); setMessage({ tone: 'ok', text: 'If that email has an account, a reset link is on its way.' }); setMode('signin'); }
      else if (mode === 'newpassword') { await auth.resetPassword(form.password); setMode('signin'); }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    try { await auth.signInWithGoogle(); } catch (err) { setMessage({ tone: 'error', text: err.message }); }
  }

  const heading = { signin: 'Welcome back', signup: 'Create your account', reset: 'Reset your password', newpassword: 'Choose a new password' }[mode];
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">{PRODUCT.name}</Link>
          <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight">{heading}</h1>
          {mode === 'signup' && <p className="mt-2 text-muted-foreground">Free to start: your first {FREE_CREDITS} drafts are on us.</p>}
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'signup' && <Field id="name" label="Your name"><input id="name" autoComplete="name" value={form.name} onChange={set('name')} className={INPUT} /></Field>}
            {mode !== 'newpassword' && <Field id="email" label="Work email"><input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={INPUT} /></Field>}
            {mode !== 'reset' && <Field id="password" label={mode === 'newpassword' ? 'New password' : 'Password'} hint={mode === 'signup' || mode === 'newpassword' ? 'At least 8 characters.' : ''}><input id="password" type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} className={INPUT} /></Field>}
            {message.text && <p role={message.tone === 'error' ? 'alert' : 'status'} className={'rounded-md px-3 py-2 text-sm ' + (message.tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted')}>{message.text}</p>}
            <button disabled={busy} className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              {busy ? 'One moment…' : { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpassword: 'Save password' }[mode]}
            </button>
          </form>
          {(mode === 'signin' || mode === 'signup') && (
            <button type="button" onClick={google} className="mt-3 w-full rounded-md border border-border py-2.5 text-sm font-medium transition hover:bg-muted">Continue with Google</button>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
            {mode === 'signin' && <Link to="/signup" className="text-primary hover:underline">Create an account</Link>}
            {mode === 'signup' && <Link to="/signin" className="text-primary hover:underline">I already have an account</Link>}
            {mode === 'signin' && <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode('reset')}>Forgot password?</button>}
            {(mode === 'reset' || mode === 'newpassword') && <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode('signin')}>Back to sign in</button>}
          </div>
        </div>
      </div>
      <aside className="hidden w-1/2 flex-col justify-end bg-muted p-12 lg:flex">
        <blockquote className="max-w-md">
          <p className="font-display text-2xl leading-snug">“{PRODUCT.tagline}”</p>
          <p className="mt-4 text-muted-foreground">{PRODUCT.pitch}</p>
        </blockquote>
      </aside>
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
