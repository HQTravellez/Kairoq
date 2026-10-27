// Chapters: the story of how it works in a few short chapters ("Book. Approve. Report."), each one
// large line, a sentence and one real visual, alternating sides. Written for Kairoq's kit.
import { cn } from '../../lib/utils.js';

// items: [{ word: 'Book.', title: 'Every trip in one place.', text: '…', visual: <img …/> or a screen }]
export function Chapters({ items = [], className }) {
  return (
    <div className={cn('space-y-24 sm:space-y-32', className)}>
      {items.map((c, i) => (
        <section key={i} className="grid items-center gap-10 lg:grid-cols-2">
          <div className={cn(i % 2 ? 'lg:order-2' : '')}>
            {c.word ? <p data-chapter="" className="font-display text-lg font-semibold text-primary">{c.word}</p> : null}
            <h2 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{c.title}</h2>
            {c.text ? <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{c.text}</p> : null}
          </div>
          <div className={cn(i % 2 ? 'lg:order-1' : '')}>{c.visual}</div>
        </section>
      ))}
    </div>
  );
}
export default Chapters;
