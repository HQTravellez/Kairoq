export default function PageHero({ eyebrow, title, text, children }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-teal-200/40 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-slate-900 sm:text-6xl">{title}</h1>
        {text && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{text}</p>}
        {children}
      </div>
    </section>
  );
}
