import { Compass, Scale, Leaf, Lock } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import Reveal from '../components/Reveal.jsx';

const PRINCIPLES = [
  { icon: Compass, title: 'Clarity over control', text: 'People follow a policy they can see. Travellez explains every flag in plain words.' },
  { icon: Scale, title: 'Fair by default', text: 'The same rules apply to everyone, and every decision is recorded with a reason.' },
  { icon: Leaf, title: 'Travel with purpose', text: 'A business reason on every trip helps teams travel when it matters and stay home when it does not.' },
  { icon: Lock, title: 'Your data is yours', text: 'Each company has its own workspace. We do not sell or share travel data.' }
];

export default function About() {
  return (
    <>
      <PageHero eyebrow="About" title="We make business travel boring, in the best way." text="Travellez started from a simple frustration: a two-day trip should not need twenty emails, three spreadsheets and a month of chasing receipts. We are building the calm, shared workspace that travelers, managers and finance teams actually want to use." />
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <h2 className="font-display text-3xl font-semibold text-slate-900">What we believe</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="card flex h-full gap-5 p-7">
                <p.icon className="shrink-0 text-teal-600" size={24} />
                <div><h3 className="font-display text-xl font-semibold text-slate-900">{p.title}</h3><p className="mt-2 text-slate-600">{p.text}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
