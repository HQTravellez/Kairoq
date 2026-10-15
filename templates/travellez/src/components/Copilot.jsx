import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Bot } from 'lucide-react';

// The AI Copilot, shown with sample answers to its example prompts.
const PROMPTS = [
  ['Book me Toronto to San Francisco next Tuesday, back Thursday.', 'Three in-policy options. Best fit: AC 795, Tue 08:15 → 10:52, $486, with The Clancy at the corporate rate ($268/night, 2 nights). Total $1,022, under your $1,500 cap. Send for approval?'],
  ['Is a $340/night hotel in London within policy?', 'No. London is a tier-1 city with a $300 cap, so $340 is $40 over. citizenM Tower is $194 at your corporate rate, 6 minutes from the client office.'],
  ["Draft the expense report for last week's Dallas trip.", 'Drafted: 5 receipts, $1,186 total, coded to CC-22 (Sales). One receipt is missing: the Hyatt Centric folio. I have asked the hotel for it.'],
  ['Who on my team is flying to Singapore this month?', 'Two people: Priya Nair (Mar 18–22) and Jonas Berg (Mar 20–24). Their stays overlap by two nights; sharing ground transport would save about $140.']
];
export default function Copilot() {
  const [pick, setPick] = useState(null);
  return (
    <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-24 lg:grid-cols-2 lg:px-8">
      <div>
        <span className="tag">AI Copilot</span>
        <h2 className="mt-4 text-balance font-display text-4xl font-bold sm:text-5xl">Say it in plain English. It's booked.</h2>
        <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-[#5f646d]">The Copilot knows your policy, your negotiated rates, your cost centers, and who's already traveling where. Ask for a trip and it comes back with in-policy options, not a search page.</p>
        <ul className="mt-6 space-y-2.5">
          {['Books flights, hotels, and ground from a single sentence', 'Checks policy before you commit, not after', 'Drafts expense reports from completed trips', 'Spots overlapping team trips worth bundling'].map((x) => <li key={x} className="flex gap-2.5 text-[15px]"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#ef3444] text-white"><Check size={12} /></span>{x}</li>)}
        </ul>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edebe8] px-5 py-3.5"><span className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#14161a] text-white"><Bot size={16} /></span><span>Travellez Copilot<span className="block text-xs font-medium text-[#8a8e96]">Policy-aware · live inventory</span></span></span><span className="flex items-center gap-1.5 text-xs font-semibold text-[#17804a]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#17804a]" />Online</span></div>
        <div className="min-h-[300px] space-y-3 p-5">
          <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-[#f4f3f0] px-4 py-3 text-sm">Hi, I'm the Travellez Copilot. Ask me to book, check policy, or pull spend.</p>
          <AnimatePresence mode="wait">
            {pick !== null && (
              <motion.div key={pick} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[#ef3444] px-4 py-3 text-sm text-white">{PROMPTS[pick][0]}</p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-[85%] rounded-2xl rounded-tl-md bg-[#f4f3f0] px-4 py-3 text-sm">{PROMPTS[pick][1]}</motion.p>
              </motion.div>
            )}
          </AnimatePresence>
          {pick === null && <p className="text-sm text-[#8a8e96]">Pick a prompt below to see the Copilot respond…</p>}
        </div>
        <div className="border-t border-[#edebe8] p-4">
          <p className="eyebrow mb-2">Try a prompt</p>
          <div className="flex flex-wrap gap-2">{PROMPTS.map(([q], i) => <button key={q} type="button" onClick={() => setPick(i)} aria-pressed={pick === i} className={'rounded-full border px-3 py-1.5 text-left text-xs font-medium transition ' + (pick === i ? 'border-[#ef3444] bg-[#fdf0f1] text-[#d0202f]' : 'border-[#e3e1dd] hover:border-[#cfccc6]')}>{q}</button>)}</div>
          <p className="mt-3 text-[11px] text-[#8a8e96]">Sample answers for illustration.</p>
        </div>
      </div>
    </section>
  );
}
