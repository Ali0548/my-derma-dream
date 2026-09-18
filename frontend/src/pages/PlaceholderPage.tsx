import { ComponentLoader } from '../components/ui/ComponentLoader';

type PlaceholderProps = {
  title: string;
  body: string;
};

export default function PlaceholderPage({ title, body }: PlaceholderProps) {
  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="bg-lumora-gradient absolute inset-x-0 top-0 h-1" />
        <h2 className="mb-2 text-xl font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-soft sm:text-[0.95rem]">{body}</p>
      </div>
      <ComponentLoader label={`${title} module will load here`} compact />
    </div>
  );
}
