'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { describeTrialStatus, getPlanName } from '@/lib/utils/subscription';

const BASE_MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/patients', label: 'Pacientes', icon: '👥' },
  { href: '/calendar', label: 'Calendario', icon: '📅' },
  { href: '/treatments', label: 'Tratamientos', icon: '🦷' },
  { href: '/payments', label: 'Pagos', icon: '💳' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/settings', label: 'Configuración', icon: '⚙️' },
];

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
  isMobile?: boolean;
};

export default function Sidebar({ onNavigate, className = '', isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isOwnerProfessional = user?.type === 'profesional' && !user.ownerProfessionalId;
  const isTeamProfessional = user?.type === 'profesional' && !!user.ownerProfessionalId;
  const items = [...BASE_MENU_ITEMS];

  if (isOwnerProfessional) {
    const billingItem = { href: '/billing', label: 'Suscripción', icon: '💼' };
    const marketingIndex = items.findIndex((item) => item.href === '/marketing');
    if (marketingIndex >= 0) {
      items.splice(marketingIndex, 0, billingItem);
    } else {
      items.push(billingItem);
    }
  }

  const handleLogout = () => {
    AuthService.logout();
    onNavigate?.();
  };

  return (
    <aside
      className={`flex h-full w-full max-w-xs flex-col border-r border-white/10 bg-slate-950/90 text-slate-100 backdrop-blur lg:max-w-none lg:w-72 ${className}`}
    >
      <div className="flex flex-col gap-3 border-b border-white/10 px-6 pb-6 pt-8">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-semibold text-white">
            Dentalist
          </Link>
          <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">
            APP
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onNavigate}
            className="self-end rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            Cerrar
          </button>
        )}
        <p className="text-sm text-slate-400">
          Gestión integral para consultorios odontológicos.
        </p>
        {user && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <p className="font-medium text-white">{user.name}</p>
            <p className="text-slate-300">{user.type === 'profesional' ? 'Profesional' : 'Paciente'}</p>
            {isOwnerProfessional && (
              <div className="mt-3 space-y-2 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/15 px-3 py-1 font-semibold text-cyan-200">
                  {getPlanName(user.subscriptionPlan ?? 'starter')} plan
                </span>
                <p className="text-slate-300">
                  {describeTrialStatus(user.trialEndsAt ?? null, user.subscriptionStatus ?? null)}
                </p>
                <Link
                  href="/billing"
                  className="inline-flex text-xs font-medium text-cyan-200 underline-offset-4 hover:underline"
                >
                  Gestionar suscripción
                </Link>
              </div>
            )}
            {isTeamProfessional && (
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-100/80">
                  {user.teamRole === 'assistant' ? 'Asistente' : 'Profesional invitado'}
                </span>
                <p>
                  Tu suscripción depende del administrador del consultorio. Podés gestionar tu acceso desde el panel de equipo.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-white/10 ${
                isActive ? 'bg-white/10 text-cyan-200' : 'text-slate-200'
              }`}
              onClick={onNavigate}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-6 text-sm text-slate-400">
        <button
          onClick={handleLogout}
          className="w-full rounded-full border border-white/10 px-4 py-2 font-medium text-slate-100 transition hover:border-rose-400/60 hover:text-rose-200"
        >
          Cerrar sesión
        </button>
        <p className="mt-4 text-xs text-slate-500">
          Soporte 24/7 via WhatsApp • Integrado con Mercado Pago y Google Calendar
        </p>
      </div>
    </aside>
  );
}