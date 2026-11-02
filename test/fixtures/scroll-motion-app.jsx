import { ParallaxImage, Parallax } from './components/ui/parallax.jsx';
import { PinnedScroll } from './components/ui/pinned-scroll.jsx';

const photo = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4226"/><stop offset="1" stop-color="#1c120c"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="400" cy="300" r="120" fill="#c8a27a"/><circle cx="1200" cy="700" r="200" fill="#8a5a3b"/></svg>');
const roasts = [
  { name: 'Aurora Light', notes: 'Ethiopia. Jasmine, peach and black tea.' },
  { name: 'Equinox Medium', notes: 'Colombia. Caramel, red apple and cocoa.' },
  { name: 'Solstice Dark', notes: 'Sumatra. Cedar, dark chocolate and molasses.' },
];

export default function App() {
  return (
    <main className="bg-background text-foreground">
      <section className="flex min-h-dvh items-center px-10"><h1 className="font-display text-6xl">Northwind Coffee Roasters</h1></section>
      <ParallaxImage src={photo} alt="Beans cooling after the roast" speed={0.3} className="h-[60vh]">
        <div className="flex h-[60vh] items-end bg-gradient-to-t from-black/70 to-transparent p-10"><p data-testid="band" className="max-w-xl text-2xl text-white">Roasted every Tuesday in small batches.</p></div>
      </ParallaxImage>
      <PinnedScroll label="Our three roasts" panelClassName="px-10">
        {roasts.map((r) => (
          <div key={r.name} className="w-full"><h2 className="font-display text-5xl">{r.name}</h2><p className="mt-4 text-lg text-muted-foreground">{r.notes}</p></div>
        ))}
      </PinnedScroll>
      <Parallax speed={0.2}><p className="px-10 py-24 text-xl">Subscribe for the Tuesday roast.</p></Parallax>
      <div className="h-[60vh]" />
    </main>
  );
}
