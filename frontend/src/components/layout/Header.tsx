import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type HeaderProps = {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
};

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex min-h-16 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 sm:items-center">
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-white shadow-soft lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-ink-soft sm:text-[0.95rem]">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <div className="max-w-[min(100%,18rem)] truncate rounded-full border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink-soft shadow-soft sm:text-sm">
          {user?.email}
        </div>
      </div>
    </header>
  );
}
