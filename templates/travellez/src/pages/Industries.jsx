import { Briefcase, Cpu, HeartHandshake, Factory, Hotel, GraduationCap } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import Reveal from '../components/Reveal.jsx';

const INDUSTRIES = [
  { icon: Briefcase, name: 'Consulting & professional services', need: 'Consultants travel to clients every week, and trips need to be billed back.', how: 'Each trip records the purpose and client. Expenses sit on the trip, so re-billing starts from a clean total.' },
  { icon: Cpu, name: 'Technology', need: 'Distributed teams meet for offsites, conferences and customer visits.', how: 'Smart Itinerary turns an offsite brief into a budget per person; small trips inside policy approve themselves.' },
  { icon: HeartHandshake, name: 'Non-profits & NGOs', need: 'Every euro is accountable to donors and boards.', how: 'Strict trip caps, a reason on every request and an approval history that is easy to audit.' },
  { icon: Factory, name: 'Manufacturing & field service', need: 'Engineers travel at short notice to sites and suppliers.', how: 'Short-notice trips are flagged, not blocked, so urgent work gets a fast manager decision.' },
  { icon: Hotel, name: 'Hospitality groups', need: 'Openings, audits and training move staff between properties.', how: 'Travelers grouped by department, hotel night caps per policy and spend by category.' },
  { icon: GraduationCap, name: 'Education & research', need: 'Conferences and fieldwork run on grants with fixed budgets.', how: 'Estimates are compared with real spend on each trip, so budgets stay honest.' }
];

export default function Industries() {
  return (
    <>
      <PageHero eyebrow="Industries" title="Built for teams that travel for work." text="Every business travels differently. These are the patterns Travellez is designed around." />
      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-20 sm:grid-cols-2 lg:grid-cols-3 lg:px-8">
        {INDUSTRIES.map((x, i) => (
          <Reveal key={x.name} delay={(i % 3) * 0.06}>
            <article className="card h-full p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><x.icon size={20} /></span>
              <h2 className="mt-5 font-display text-xl font-semibold text-slate-900">{x.name}</h2>
              <p className="mt-3 text-sm font-medium text-slate-800">The need</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{x.need}</p>
              <p className="mt-4 text-sm font-medium text-slate-800">How Travellez helps</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{x.how}</p>
            </article>
          </Reveal>
        ))}
      </section>
    </>
  );
}
