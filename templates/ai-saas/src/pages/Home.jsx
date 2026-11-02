import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { usePageMeta } from 'kairoq';
import { PRODUCT, PLANS, FAQ, FREE_CREDITS } from '../saas.config.js';
import { useSession } from '../lib/session.js';

const STEPS = [
  ['Paste the brief', 'The client’s email, call notes or RFP. Messy is fine.'],
  ['Get a real first draft', 'Scope, steps, timeline and the questions you still need answered, in your tone.'],
  ['Finish it as a team', 'Drafts are shared with your team, so a colleague can pick up where you left off.']
];
const SAMPLE = {
  brief: '“We rent skis and bikes in two shops. Customers call to book and we lose bookings when we’re busy. Can you build online booking before December? Budget around $20k.”',
  draft: [
    ['Summary', 'Online booking for both shops, live before the December rush.'],
    ['What we understood', 'Phone bookings are lost at peak times; you need customers to book and pay without calling.'],
    ['What we will do', '1. Map rentals and stock per shop  2. Booking and payment flow  3. Staff view for pick-ups'],
    ['To confirm', 'Deposit or full payment? [TO CONFIRM]']
  ]
};

export default function Home() {
  usePageMeta({ title: PRODUCT.name + ' · ' + PRODUCT.tagline, description: PRODUCT.pitch });
  const { user } = useSession();
  const cta = user ? { to: '/app', label: 'Open ' + PRODUCT.name } : { to: '/signup', label: 'Start free' };
  return (
    <div className="bg-background text-foreground">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight">{PRODUCT.name}</Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm">
          <a href="#pricing" className="hidden text-muted-foreground hover:text-foreground sm:inline">Pricing</a>
          <a href="#faq" className="hidden text-muted-foreground hover:text-foreground sm:inline">Questions</a>
          {!user && <Link to="/signin" className="text-muted-foreground hover:text-foreground">Sign in</Link>}
          <Link to={cta.to} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90">{cta.label}</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <h1 className="max-w-xl font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">{PRODUCT.tagline}</h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">{PRODUCT.pitch}</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link to={cta.to} className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90">{cta.label}</Link>
            <span className="text-sm text-muted-foreground">{FREE_CREDITS} free drafts. No card needed.</span>
          </div>
        </div>
        <figure aria-label="An example brief and the draft written from it" className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">The brief</p>
          <p className="mt-2 font-display text-lg leading-snug">{SAMPLE.brief}</p>
          <div className="my-5 border-t border-dashed border-border" />
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">The draft, 40 seconds later</p>
          <dl className="mt-3 space-y-3 text-sm">
            {SAMPLE.draft.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3"><dt className="font-medium">{k}</dt><dd className="text-muted-foreground">{v}</dd></div>
            ))}
          </dl>
        </figure>
      </section>

      <section aria-labelledby="how" className="border-y border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 id="how" className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="font-display text-4xl text-primary">{i + 1}</span>
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-5 py-20">
        <h2 id="pricing-title" className="font-display text-3xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-2 text-muted-foreground">Start free with {FREE_CREDITS} drafts. Upgrade when it earns its keep.</p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          <Plan name="Free" price="$0" features={[FREE_CREDITS + ' drafts to try it', 'One team', 'Copy drafts anywhere']} cta={cta} />
          {PLANS.map((p, i) => <Plan key={p.product} name={p.name} price={p.price} features={p.features} cta={{ to: user ? '/app/billing' : '/signup', label: 'Choose ' + p.name }} highlight={i === PLANS.length - 1} />)}
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-5 pb-24">
        <h2 id="faq-title" className="font-display text-3xl font-semibold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">{q}<span aria-hidden className="text-muted-foreground transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {PRODUCT.name}</span>
          <a href={'mailto:' + PRODUCT.supportEmail} className="hover:text-foreground">{PRODUCT.supportEmail}</a>
        </div>
      </footer>
    </div>
  );
}

function Plan({ name, price, features, cta, highlight }) {
  return (
    <div className={'flex flex-col bg-background p-7 ' + (highlight ? 'md:bg-card' : '')}>
      <h3 className="font-medium">{name}</h3>
      <p className="mt-2 font-display text-3xl font-semibold">{price}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />{f}</li>)}
      </ul>
      <Link to={cta.to} className={'mt-8 rounded-md px-4 py-2.5 text-center text-sm font-medium transition ' + (highlight ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border border-border hover:bg-muted')}>{cta.label}</Link>
    </div>
  );
}
