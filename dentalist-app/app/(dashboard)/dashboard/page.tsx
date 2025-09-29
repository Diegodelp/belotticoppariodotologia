'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardOverview {
  totals: {
    patients: number;
    activePatients: number;
    appointmentsToday: number;
    revenueThisMonth: number;
    outstandingBalance: number;
    totalTreatments: number;
  };
  upcomingAppointments: Array<{
    id: string;
    patientId: string;
    date: string;
    time: string;
    type: string;
    status: string;
  }>;
  treatmentByType: Record<string, number>;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/overview');
        if (!response.ok) {
          throw new Error('No pudimos obtener los indicadores');
        }
        const data = await response.json();
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado');
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  return (
    <section className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {loading && <p className="text-slate-300">Cargando indicadores...</p>}
        {error && <p className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
        {overview && !loading && (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
              <p className="text-sm text-slate-300">Pacientes activos</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {overview.totals.activePatients}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Total registrados: {overview.totals.patients}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
              <p className="text-sm text-slate-300">Turnos para hoy</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {overview.totals.appointmentsToday}
              </p>
              <Link
                href="/calendar"
                className="mt-3 inline-flex text-xs text-cyan-200 underline-offset-4 hover:underline"
              >
                Abrir agenda
              </Link>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
              <p className="text-sm text-slate-300">Facturación del mes</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatCurrency(overview.totals.revenueThisMonth)}
              </p>
              <p className="mt-2 text-xs text-emerald-300">
                Cobros pendientes: {formatCurrency(overview.totals.outstandingBalance)}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
              <p className="text-sm text-slate-300">Tratamientos registrados</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {overview.totals.totalTreatments}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Tipos activos: {Object.keys(overview.treatmentByType).length}
              </p>
            </div>
          </>
        )}
      </div>

      {overview && (
        <div className="grid gap-8 lg:grid-cols-[1.5fr,1fr] xl:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Próximos turnos</h2>
              <Link href="/calendar" className="text-xs text-cyan-200 hover:underline">
                Ver calendario completo
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {overview.upcomingAppointments.length === 0 && (
                <p className="text-sm text-slate-400">
                  No hay turnos agendados para los próximos días.
                </p>
              )}
              {overview.upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-white">{appointment.type}</p>
                    <p className="text-xs text-slate-400">
                      {appointment.date} • {appointment.time}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs capitalize text-cyan-200">
                    {appointment.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <h2 className="text-lg font-semibold text-white">Tratamientos por especialidad</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {Object.entries(overview.treatmentByType).map(([type, total]) => (
                <div key={type} className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-3 py-2">
                  <span>{type}</span>
                  <span className="text-white">{total}</span>
                </div>
              ))}
              {Object.keys(overview.treatmentByType).length === 0 && (
                <p className="text-sm text-slate-400">
                  Aún no registraste tratamientos. Crealos desde la ficha del paciente.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}