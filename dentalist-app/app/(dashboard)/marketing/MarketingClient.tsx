
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/hooks/useAuth';
import { GeminiService } from '@/services/gemini.service';
import { MarketingService } from '@/services/marketing.service';
import { planSupportsCapability } from '@/lib/utils/subscription';
import type { GeminiConnectionStatus, MarketingInsightsResponse } from '@/types';

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function MarketingClient() {
  const { user } = useAuth();
  const [status, setStatus] = useState<GeminiConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [insights, setInsights] = useState<MarketingInsightsResponse | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const canUseMarketing = useMemo(() => {
    if (!user) return false;
    return (
      user.type === 'profesional' &&
      !user.ownerProfessionalId &&
      planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')
    );
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!canUseMarketing) {
      setStatus(null);
      setStatusLoading(false);
      return () => {
        active = false;
      };
    }

    const loadStatus = async () => {
      try {
        setStatusLoading(true);
        const response = await GeminiService.getStatus();
        if (!active) return;
        setStatus(response);
      } catch (err) {
        console.error('Error al consultar el estado de Gemini', err);
        if (active) {
          setStatus(null);
          setError('No pudimos consultar el estado de la integración con Gemini.');
        }
      } finally {
        if (active) {
          setStatusLoading(false);
        }
      }
    };

    loadStatus();

    return () => {
      active = false;
    };
  }, [canUseMarketing, refreshIndex]);

  useEffect(() => {
    let active = true;
    if (!canUseMarketing || statusLoading) {
      return () => {
        active = false;
      };
    }

    if (!status?.connected) {
      setNeedsConnection(true);
      setInsights(null);
      setLoadingInsights(false);
      return () => {
        active = false;
      };
    }

    const loadInsights = async () => {
      try {
        setNeedsConnection(false);
        setLoadingInsights(true);
        setError(null);
        const data = await MarketingService.getInsights();
        if (!active) return;
        setInsights(data);
      } catch (err) {
        if (!active) return;
        console.error('Error al generar insights', err);
        const statusCode = (err as Error & { status?: number }).status ?? 500;
        if (statusCode === 412) {
          setNeedsConnection(true);
          setError(null);
          setInsights(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'No pudimos generar insights en este momento. Intentá nuevamente más tarde.',
          );
        }
      } finally {
        if (active) {
          setLoadingInsights(false);
        }
      }
    };

    loadInsights();

    return () => {
      active = false;
    };
  }, [canUseMarketing, status, statusLoading]);

  const handleRefresh = () => {
    setRefreshIndex((value) => value + 1);
  };

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Iniciá sesión para ver el panel de marketing.
      </div>
    );
  }

  if (!canUseMarketing) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Marketing y crecimiento</h1>
          <p className="text-sm text-slate-300">
            Activá el plan Pro para recibir insights personalizados generados con IA sobre tus métricas reales.
          </p>
        </header>
        <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-6 text-sm text-amber-100">
          <p>
            Tu plan actual no incluye la automatización de marketing con IA. Mejorá a{' '}
            <Link href="/billing" className="font-semibold underline-offset-4 hover:underline text-amber-50">
              Pro
            </Link>{' '}
            para habilitar proyecciones, campañas sugeridas y análisis inteligentes sobre WhatsApp e Instagram.
          </p>
        </div>
      </div>
    );
  }

  const updatedAtLabel = insights
    ? new Date(insights.generatedAt).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
    : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Marketing y crecimiento</h1>
          <p className="text-sm text-slate-300">
            Analizá ingresos, pacientes y tratamientos con Gemini para planificar tus próximas campañas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            Actualizar
          </button>
        </div>
      </header>

      {statusLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Consultando el estado de la integración con Gemini...
        </div>
      ) : needsConnection ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
          <p className="font-semibold text-white">Configurá Gemini para usar tus datos reales</p>
          <p className="mt-2 text-slate-300">
            Guardá tu API key de Google AI Studio desde{' '}
            <Link href="/settings" className="font-semibold text-cyan-200 underline-offset-4 hover:underline">
              Configuración &gt; Google &amp; IA
            </Link>{' '}
            y obtené recomendaciones automáticas basadas en la actividad de tu clínica.
          </p>
        </div>
      ) : null}

      {error && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-100">
          {error}
        </div>
      )}

      {status?.connected && (
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-6 text-sm text-emerald-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-emerald-100">Gemini conectado</p>
              <p className="text-emerald-200/80">
                Insights habilitados con {status.label ? `la clave “${status.label}”` : 'tu API key guardada'}.
              </p>
            </div>
            {status.updatedAt && (
              <p className="text-xs text-emerald-200/70">
                Última actualización:{' '}
                {new Date(status.updatedAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </div>
        </div>
      )}

      {status?.connected && !needsConnection && (
        <div className="space-y-8">
          {loadingInsights && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              Generando insights con tus métricas reales...
            </div>
          )}

          {insights && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-cyan-500/10">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Ingresos 30 días</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {formatCurrency(insights.metrics.revenueLast30Days)}
                  </p>
                </article>
                <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-cyan-500/10">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Pacientes nuevos</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {insights.metrics.newPatientsLast30Days}
                  </p>
                </article>
                <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-cyan-500/10">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Asistencia</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {formatPercent(insights.metrics.attendanceRate)}
                  </p>
                </article>
                <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-cyan-500/10">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Saldo pendiente</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {formatCurrency(insights.metrics.outstandingBalance)}
                  </p>
                </article>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white">Ingresos por mes</h2>
                  <div className="mt-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={insights.charts.revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ background: '#0f172a', borderRadius: 16, border: '1px solid rgba(148,163,184,0.4)' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#22d3ee" fill="rgba(34,211,238,0.25)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white">Asistencia diaria</h2>
                  <div className="mt-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={insights.charts.appointmentTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', borderRadius: 16, border: '1px solid rgba(148,163,184,0.4)' }}
                        />
                        <Bar dataKey="booked" stackId="a" fill="rgba(148,163,184,0.4)" name="Reservados" />
                        <Bar dataKey="attended" stackId="a" fill="rgba(34,197,94,0.7)" name="Asistieron" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold text-white">Resumen estratégico</h2>
                <p className="mt-3 text-sm text-slate-200 leading-relaxed">{insights.ai.summary}</p>

                {(insights.ai.opportunities.length > 0 || insights.ai.risks.length > 0) && (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    {insights.ai.opportunities.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-300">Oportunidades</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-200">
                          {insights.ai.opportunities.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="text-emerald-300">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {insights.ai.risks.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-rose-300">Alertas</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-200">
                          {insights.ai.risks.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="text-rose-300">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white">WhatsApp sugerido</h2>
                  {insights.ai.whatsappCampaigns.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-300">
                      Aún no hay campañas sugeridas. Reintentá cuando registres más actividad comercial.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {insights.ai.whatsappCampaigns.map((campaign) => (
                        <div key={campaign.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                          <p className="text-base font-semibold text-white">{campaign.title}</p>
                          <p className="mt-2 whitespace-pre-line text-slate-300">{campaign.script}</p>
                          <p className="mt-3 text-xs text-cyan-200">CTA sugerido: {campaign.callToAction}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white">Ideas para Instagram</h2>
                  {insights.ai.instagramCampaigns.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-300">
                      Cargá más tratamientos y pagos para recibir recomendaciones específicas.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {insights.ai.instagramCampaigns.map((campaign) => (
                        <div key={campaign.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
                          <p className="text-base font-semibold text-white">{campaign.title}</p>
                          <p className="mt-2 text-slate-300">{campaign.concept}</p>
                          <p className="mt-2 whitespace-pre-line text-slate-400">{campaign.caption}</p>
                          <p className="mt-3 text-xs text-rose-200">CTA sugerido: {campaign.callToAction}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            </>
          )}
        </div>
      )}

      {updatedAtLabel && (
        <p className="text-xs text-slate-500">Última generación: {updatedAtLabel}</p>
      )}
    </div>
  );
}
