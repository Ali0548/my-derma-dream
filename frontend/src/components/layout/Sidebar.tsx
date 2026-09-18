import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  LineChart,
  ScrollText,
  Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/users', label: 'Users', icon: Users },
  { to: '/app/performance', label: 'Performance', icon: LineChart },
  { to: '/app/rules', label: 'CPA Rules', icon: Settings2 },
  { to: '/app/audit', label: 'Order Audit', icon: ScrollText },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { logout, user } = useAuth();

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className={clsx(
          'fixed inset-0 z-30 cursor-pointer bg-ink/40 backdrop-blur-[2px] transition lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'bg-sidebar-gradient fixed inset-y-0 left-0 z-40 flex w-[min(100%,17.5rem)] flex-col px-4 py-5 text-foam shadow-[12px_0_40px_rgba(7,26,22,0.28)] transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-[105%] lg:translate-x-0',
        )}
      >
        <div className="bg-lumora-gradient absolute inset-x-0 top-0 h-1 opacity-90" />

        <div className="mb-5 border-b border-white/10 px-2 pb-5 pt-1">
          <NavLink
            to="/app"
            end
            onClick={onClose}
            className="flex cursor-pointer items-center gap-3 rounded-xl outline-none transition hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lumora-gradient text-lg font-extrabold text-white shadow-[0_10px_24px_rgba(26,168,184,0.3)]">
              L
            </span>
            <div>
              <strong className="block text-[1.1rem] font-extrabold tracking-tight text-white">
                Lumora Labs
              </strong>
              <p className="text-xs text-white/60">Affiliate desk</p>
            </div>
          </NavLink>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition',
                  isActive
                    ? 'bg-white/12 text-white shadow-inner ring-1 ring-white/15'
                    : 'text-white/70 hover:bg-white/8 hover:text-white',
                )
              }
            >
              <Icon size={18} className="shrink-0 opacity-90" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
          <div className="px-1">
            <strong className="block text-sm text-white">{user?.name}</strong>
            <span className="text-xs capitalize text-white/55">{user?.role}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/8 hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
