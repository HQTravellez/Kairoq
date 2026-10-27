// A sample software landing page made of the "show it working" kit pieces (test fixture).
import { useState } from 'react';
import { TypedInput } from './components/ui/typed-input.jsx';
import { ProductTour } from './components/ui/product-tour.jsx';
import { ScrollLitText } from './components/ui/scroll-lit-text.jsx';
import { Chapters } from './components/ui/chapters.jsx';
import { BackgroundPaths } from './components/ui/background-paths.jsx';
import { TextLoop } from './components/ui/text-loop.jsx';

const Row = ({ a, b, on }) => (
  <div className={'flex items-center justify-between border-b px-4 py-3 text-sm ' + (on ? 'bg-primary/10' : '')}><span>{a}</span><span className="text-muted-foreground">{b}</span></div>
);
const Search = () => (<div className="p-4"><div className="rounded-md border px-3 py-2 text-sm">Lisbon, 12 to 15 May</div><div className="mt-3 rounded-md border"><Row a="TAP 08:10 → 10:35" b="Within policy" on /><Row a="Hotel Alma, 3 nights" b="Within policy" /><Row a="easyJet 13:20 → 15:50" b="Over budget" /></div></div>);
const Approve = () => (<div className="p-4"><p className="text-sm font-medium">Trip to Lisbon</p><p className="text-sm text-muted-foreground">Waiting for your approval</p><div className="mt-6 flex gap-2"><span className="rounded-md border px-3 py-2 text-sm">Ask a question</span><span className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Approve trip</span></div></div>);
const Report = () => (<div className="p-4"><p className="text-sm font-medium">May spending</p><div className="mt-4 flex h-32 items-end gap-3">{[40, 65, 30, 80].map((h, i) => <div key={i} className="w-10 bg-primary/70" style={{ height: h + '%' }} />)}</div></div>);

export default function App() {
  const [q, setQ] = useState('');
  const faded = new URLSearchParams(location.search).has('faded');
  return (
    <main className="bg-background text-foreground">
      <BackgroundPaths strength={0.5} className={'min-h-[520px] ' + (faded ? 'opacity-30' : '')}>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">Business travel for <TextLoop><span>teams</span><span>founders</span><span>assistants</span></TextLoop></h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Book within policy, get approval in one tap, and the report writes itself.</p>
          <TypedInput className="mx-auto mt-8 max-w-xl" label="Where to?" buttonLabel="Search trips" examples={['Lisbon, 3 nights in May', 'Team offsite near Berlin']} onSubmit={setQ} />
          {q ? <p className="mt-3 text-sm" data-testid="searched">Searching: {q}</p> : null}
        </div>
      </BackgroundPaths>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <ProductTour address="app.travellez.com" interval={1400} steps={[
          { caption: 'Search flights and hotels in one place', screen: <Search />, cursor: { x: 70, y: 32 } },
          { caption: 'Send the trip for approval', screen: <Approve />, cursor: { x: 34, y: 34 } },
          { caption: 'Spending is reported for you', screen: <Report />, cursor: { x: 40, y: 60 } },
        ]} />
      </div>
      <div className="mx-auto max-w-4xl px-6 py-24"><ScrollLitText text="Business travel should take minutes to book, never a day to approve, and no one should rebuild the report by hand." /></div>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Chapters items={[
          { word: 'Book.', title: 'Every trip in one place.', text: 'Flights, hotels and trains with your company rules built in.', visual: <div className="aspect-[16/10] rounded-lg border"><Search /></div> },
          { word: 'Approve.', title: 'One tap for managers.', text: 'Managers see the trip and its cost, and approve it.', visual: <div className="aspect-[16/10] rounded-lg border"><Approve /></div> },
          { word: 'Report.', title: 'Spending, already sorted.', visual: <div className="aspect-[16/10] rounded-lg border"><Report /></div> },
        ]} />
      </div>
    </main>
  );
}
