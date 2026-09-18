import { useAuth } from '../context/AuthContext';

export default function OverviewPage() {
  const { user } = useAuth();

  return (
    <div className="grid gap-5">
      <section className="bg-hero-gradient relative overflow-hidden rounded-3xl border border-line p-5 shadow-panel sm:p-7">
        <div className="bg-lumora-gradient absolute inset-x-0 top-0 h-1 opacity-80" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-mint/10 blur-2xl" />

        <span className="mb-3 inline-flex rounded-lg border border-brand/25 bg-foam px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-brand-deep">
          Welcome to Lumora Labs
        </span>
        <h2 className="mb-2 text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-tight text-ink">
          {user?.name}
        </h2>
        <p className="max-w-[54ch] text-[0.95rem] leading-relaxed text-ink-soft">
          This desk will answer one question clearly: which affiliate partners make money, and
          which lose money.
        </p>
      </section>

      <section className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: 'Performance report',
            body: 'Day-by-day revenue, spend, ROAS, sales, and AOV by affiliate.',
          },
          {
            title: 'CPA rule editor',
            body: 'Create deals, catch overlaps, and preview commission before saving.',
          },
          {
            title: 'Order audit',
            body: 'Open any order and see exactly why a rule won.',
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-panel"
          >
            <h3 className="mb-2 text-[1.05rem] font-extrabold tracking-tight text-ink">
              {card.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-soft">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
