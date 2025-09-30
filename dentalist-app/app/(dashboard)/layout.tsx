'use client';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { userHasLockedSubscription } from '@/lib/utils/subscription';

function DashboardTopBar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900/80 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-white transition hover:border-cyan-300 hover:text-cyan-200 lg:hidden"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white sm:text-xl">Panel Dentalist</h1>
            <p className="text-xs text-slate-400 sm:text-sm">
              Coordiná tu consultorio desde la app APP - Dentalist
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 sm:gap-4 sm:text-sm">
          <Link
            href="/calendar"
            className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Ver agenda
          </Link>
          {user && (
            <div className="text-left sm:text-right">
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user || user.type !== 'profesional') {
      return;
    }

    if (userHasLockedSubscription(user)) {
      if (!pathname?.startsWith('/billing') && !pathname?.startsWith('/pricing')) {
        router.replace('/billing?state=trial_expired');
      }
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Cargando panel...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <p className="text-center text-lg font-medium">Tu sesión expiró. Iniciá sesión para continuar.</p>
        <Link
          href="/login"
          className="rounded-full border border-white/20 px-5 py-2 font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200"
        >
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 flex lg:hidden">
          <button
            type="button"
            className="flex-1 bg-slate-950/70"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          />
          <Sidebar
            isMobile
            onNavigate={() => setMobileMenuOpen(false)}
            className="max-w-xs"
          />
        </div>
      )}

      <main className="relative flex-1 overflow-y-auto">
        <DashboardTopBar onToggleMenu={() => setMobileMenuOpen(true)} />
        <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_25%_0%,rgba(56,189,248,0.15),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative z-10 space-y-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
