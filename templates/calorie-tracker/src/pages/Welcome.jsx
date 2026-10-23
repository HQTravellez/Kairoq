import { useState } from 'react';
import { auth } from 'kairoq';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Brand } from '../components/Shell.jsx';

export default function Welcome() {
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === 'reset') { await auth.requestPasswordReset(form.email); toast.success('Check your inbox for a reset link.'); setMode('signin'); }
      else if (mode === 'signup') await auth.signUp(form.email, form.password, form.name);
      else await auth.signIn(form.email, form.password);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="relative overflow-hidden bg-[#0c1222] px-6 pb-14 pt-10 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c6f432]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#34d399]/20 blur-3xl" />
        <div className="relative [&_span]:text-white"><Brand /></div>
        <div className="relative mt-14 lg:mt-0">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">Eat well,<br />without the<br /><span className="text-[#c6f432]">spreadsheet.</span></motion.h1>
          <p className="mt-5 max-w-sm text-lg text-white/70">Log meals in seconds, see your protein at a glance, and watch the trend, not the scale.</p>
          <div className="mt-8 flex gap-6 text-sm text-white/70">
            <div><p className="text-2xl font-extrabold text-white">60+</p>everyday foods</div>
            <div><p className="text-2xl font-extrabold text-white">5 s</p>to log a meal</div>
            <div><p className="text-2xl font-extrabold text-white">AI</p>meal estimates</div>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-3xl font-extrabold tracking-tight">{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Welcome back'}</h2>
          <p className="mt-2 text-slate-500">{mode === 'signup' ? 'Free. Takes 30 seconds, then we set your daily target.' : mode === 'reset' ? 'We will email you a link.' : 'Sign in to see today.'}</p>
          <div className="mt-8 space-y-4">
            {mode === 'signup' && <label className="block text-sm font-semibold">First name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field mt-1.5 bg-white ring-1 ring-black/10" autoComplete="given-name" /></label>}
            <label className="block text-sm font-semibold">Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field mt-1.5 bg-white ring-1 ring-black/10" autoComplete="email" /></label>
            {mode !== 'reset' && <label className="block text-sm font-semibold">Password<input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="field mt-1.5 bg-white ring-1 ring-black/10" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}
          </div>
          <button disabled={busy} className="btn mt-6 w-full">{busy && <Loader2 className="animate-spin" size={18} />}{mode === 'signup' ? 'Get started' : mode === 'reset' ? 'Send link' : 'Sign in'}</button>
          {mode !== 'reset' && <button type="button" onClick={() => auth.signInWithGoogle().catch((err) => toast.error(err.message))} className="btn-soft mt-3 w-full">Continue with Google</button>}
          <div className="mt-6 flex justify-between text-sm font-semibold">
            <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} className="text-[#0c1222]">{mode === 'signup' ? 'I have an account' : 'Create account'}</button>
            <button type="button" onClick={() => setMode(mode === 'reset' ? 'signin' : 'reset')} className="text-slate-400">{mode === 'reset' ? 'Back' : 'Forgot password?'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
