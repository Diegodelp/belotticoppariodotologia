'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  describeTrialStatus,
  getPlanDefinition,
  getTrialCountdown,
} from '@/lib/utils/subscription';

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
  const { user } = useAuth();

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
      {user?.type === 'profesional' && (
        <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 text-slate-100 shadow-lg shadow-cyan-500/10">
          {(() => {
            const plan = getPlanDefinition(user.subscriptionPlan ?? 'starter');
            const { daysLeft } = getTrialCountdown(user.trialEndsAt ?? null);
            const planHighlights = [
              {
                label:
                  plan.capabilities.patientLimit && plan.capabilities.patientLimit > 0
                    ? `Hasta ${plan.capabilities.patientLimit} pacientes activos`
                    : 'Pacientes ilimitados',
                enabled: true,
              },
              {
                label: 'Automatizaciones de marketing en WhatsApp e Instagram',
                enabled: plan.capabilities.marketingAutomation,
              },
              {
                label: 'Insights predictivos por IA',
                enabled: plan.capabilities.aiInsights,
              },
              {
                label: `${plan.capabilities.storageGb} GB de almacenamiento clínico seguro`,
                enabled: true,
              },
            ];

            return (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                      Plan actual
                    </span>
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">{plan.name}</h2>
                    <p className="max-w-2xl text-sm text-cyan-100/80">{plan.highlight}</p>
                    <p className="text-xs text-slate-200/80">
                      {describeTrialStatus(user.trialEndsAt ?? null, user.subscriptionStatus ?? null)}
                      {typeof daysLeft === 'number' && daysLeft > 0 && user.subscriptionStatus !== 'active' && (
                        <span className="ml-2 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white">
                          Quedan {daysLeft} días de prueba
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-cyan-100 sm:items-end">
                    <span className="text-xl font-semibold text-white">{plan.priceLabel}</span>
                    <Link
                      href="/billing"
                      className="inline-flex items-center gap-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 hover:text-cyan-200"
                    >
                      Ver opciones de suscripción →
                    </Link>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 text-xs text-cyan-100 sm:grid-cols-2 lg:grid-cols-4">
                  {planHighlights.map((highlight) => (
                    <div
                      key={highlight.label}
                      className={`flex items-start gap-2 rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3 ${
                        highlight.enabled ? 'text-cyan-100' : 'text-slate-400'
                      }`}
                    >
                      <span>{highlight.enabled ? '✅' : '🔒'}</span>
                      <span>{highlight.label}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

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