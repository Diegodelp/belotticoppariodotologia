'use client';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

function DashboardTopBar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/70 backdrop-blur">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Panel Dentalist</h1>
          <p className="text-sm text-slate-400">
            Coordiná tu consultorio desde la app APP - Dentalist
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <Link href="/calendar" className="rounded-full border border-white/10 px-3 py-1.5 hover:border-cyan-300 hover:text-cyan-200">
            Ver agenda
          </Link>
          {user && (
            <div className="text-right">
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
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto">
        <DashboardTopBar />
        <div className="px-8 pb-16 pt-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_25%_0%,rgba(56,189,248,0.15),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.12),transparent_45%)]" />
          <div className="relative z-10 space-y-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
