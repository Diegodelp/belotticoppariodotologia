'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/patients', label: 'Pacientes', icon: '👥' },
  { href: '/calendar', label: 'Calendario', icon: '📅' },
  { href: '/treatments', label: 'Tratamientos', icon: '🦷' },
  { href: '/payments', label: 'Pagos', icon: '💳' },
  { href: '/settings', label: 'Configuración', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const handleLogout = () => {
    AuthService.logout();
  };

  return (
    <aside className="flex w-72 flex-col border-r border-white/10 bg-slate-950/80 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-white/10 px-6 pb-6 pt-8">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-semibold text-white">
            Dentalist
          </Link>
          <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">
            APP
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Gestión integral para consultorios odontológicos.
        </p>
        {user && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <p className="font-medium text-white">{user.name}</p>
            <p className="text-slate-300">{user.type === 'profesional' ? 'Profesional' : 'Paciente'}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {menuItems.map((item) => {
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