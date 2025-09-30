'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  describeTrialStatus,
  getPlanDefinition,
  getTrialCountdown,
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  TRIAL_DURATION_DAYS,
} from '@/lib/utils/subscription';

const COMPARISON_POINTS = [
  {
    label: 'Pacientes y contactos gestionados',
    starter: 'Hasta 200 activos en simultáneo',
    pro: 'Ilimitados',
  },
  {
    label: 'Usuarios y asistentes incluidos',
    starter: '1 profesional + 2 asistentes',
    pro: 'Hasta 10 usuarios sin costo extra',
  },
  {
    label: 'Automatizaciones de marketing',
    starter: 'Recordatorios y campañas manuales',
    pro: 'Flows automáticos en WhatsApp e Instagram',
  },
  {
    label: 'Insights por IA y reportes avanzados',
    starter: 'Panel financiero esencial',
    pro: 'Predicciones de cobranzas, ausentismo y ventas',
  },
  {
    label: 'Almacenamiento clínico',
    starter: '25 GB incluidos',
    pro: '200 GB + retención extendida',
  },
];

export default function BillingPage() {
  const { user, loading } = useAuth();
  const currentPlan = useMemo(
    () => getPlanDefinition(user?.subscriptionPlan ?? 'starter'),
    [user?.subscriptionPlan],
  );
  const proPlan = PLAN_DEFINITIONS.pro;
  const { daysLeft } = getTrialCountdown(user?.trialEndsAt ?? null);
  const trialStatus = describeTrialStatus(user?.trialEndsAt ?? null, user?.subscriptionStatus ?? null);
  const isProPlan = currentPlan.id === 'pro';
  const showUpgradeContent = !isProPlan;
  const showComparison = !isProPlan;
  const renewalInfo = useMemo(() => {
    if (!user || user.type !== 'profesional') {
      return null;
    }
    const formatDate = (value: string | null | undefined) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    };

    const status = user.subscriptionStatus ?? 'trialing';

    if (status === 'trialing') {
      const formatted = formatDate(user.trialEndsAt);
      return formatted ? `La prueba vence el ${formatted}.` : 'La prueba gratuita está activa.';
    }

    if (status === 'active') {
      const formatted = formatDate(user.trialEndsAt);
      return formatted
        ? `La próxima renovación estimada es el ${formatted}.`
        : 'Tu plan se renueva automáticamente cada mes.';
    }

    if (status === 'trial_expired') {
      const formatted = formatDate(user.trialEndsAt);
      return formatted ? `La prueba finalizó el ${formatted}.` : 'La prueba gratuita finalizó.';
    }

    if (status === 'past_due') {
      const formatted = formatDate(user.subscriptionLockedAt ?? user.trialEndsAt);
      return formatted
        ? `Detectamos un vencimiento de pago el ${formatted}. Contactanos para regularizarlo.`
        : 'Detectamos pagos pendientes en tu suscripción.';
    }

    if (status === 'cancelled') {
      const formatted = formatDate(user.subscriptionLockedAt ?? user.trialEndsAt);
      return formatted ? `El plan se canceló el ${formatted}.` : 'El plan figura como cancelado.';
    }

    return null;
  }, [user]);

  if (loading) {
    return (
      <section className="flex min-h-[320px] items-center justify-center">
        <p className="text-sm text-slate-300">Cargando información de tu suscripción…</p>
      </section>
    );
  }

  if (!user || user.type !== 'profesional') {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Acceso restringido</h1>
          <p className="text-sm text-slate-300">
            Solo los profesionales titulares pueden administrar una suscripción en Dentalist.
          </p>
        </header>
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/40 hover:text-cyan-100"
        >
          Volver al panel principal
        </Link>
      </section>
    );
  }

  if (user.ownerProfessionalId) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Suscripción administrada por tu equipo</h1>
          <p className="text-sm text-slate-300">
            Esta cuenta pertenece al equipo de otro profesional. Solo el titular puede contratar o modificar planes.
          </p>
        </header>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
          <p>
            Si necesitás cambios en la suscripción comunicate con el administrador del consultorio o desvinculate desde la
            configuración del equipo.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex w-fit items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:text-cyan-100"
          >
            Ir a configuración
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white">Suscripción y facturación</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Administrá tu prueba gratuita de {TRIAL_DURATION_DAYS} días, activá el plan que mejor se adapte a tu consultorio y conocé los beneficios de Dentalist Pro.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
        <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 text-slate-100 shadow-lg shadow-cyan-500/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">
                Plan actual
              </span>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">{currentPlan.name}</h2>
              <p className="text-sm text-cyan-100/90">{currentPlan.highlight}</p>
              <p className="text-xs text-slate-200/80">
                {trialStatus}
                {typeof daysLeft === 'number' && daysLeft > 0 && user?.subscriptionStatus !== 'active' && (
                  <span className="ml-2 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white">
                    {daysLeft === 1 ? 'Queda 1 día de prueba' : `Quedan ${daysLeft} días de prueba`}
                  </span>
                )}
              </p>
              {renewalInfo && <p className="text-xs text-cyan-50/80">{renewalInfo}</p>}
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-cyan-100 sm:items-end">
              <span className="text-xl font-semibold text-white">{currentPlan.priceLabel}</span>
              <Link
                href="mailto:hola@dentalist.com"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 hover:text-cyan-100"
              >
                ¿Necesitás factura o ayuda?
              </Link>
            </div>
          </div>
        </div>

        {showUpgradeContent && (
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 shadow-lg shadow-cyan-500/10">
            <h3 className="text-lg font-semibold text-white">¿Cómo activo Pro?</h3>
            <p className="mt-2 text-slate-300">
              Coordiná con nuestro equipo para activar Pro en minutos. Migramos tus datos, configuramos las automatizaciones y capacitamos a tu staff.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <p className="font-semibold text-cyan-200">{proPlan.priceLabel}</p>
              <ul className="space-y-2 text-slate-300">
                <li>✔️ Onboarding personalizado y soporte prioritario 24/7</li>
                <li>✔️ Integración oficial de WhatsApp Business e Instagram Ads</li>
                <li>✔️ Insights por IA y seguimiento financiero avanzado</li>
              </ul>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="https://wa.me/5491156754321?text=Quiero%20migrar%20a%20Dentalist%20Pro"
                className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Hablar con un asesor
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:text-cyan-100"
              >
                Ver detalle de planes
              </Link>
            </div>
          </aside>
        )}
      </div>

      {showComparison && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-white">Comparativa de beneficios</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Característica</th>
                  {PLAN_ORDER.map((planId) => (
                    <th key={planId} className="px-4 py-3 font-semibold text-center">
                      {PLAN_DEFINITIONS[planId].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_POINTS.map((item) => (
                  <tr key={item.label} className="odd:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-200">{item.label}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{item.starter}</td>
                    <td className="px-4 py-3 text-center text-cyan-200">{item.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
          <h3 className="text-lg font-semibold text-white">Facturación y pagos</h3>
          <p className="mt-2 text-sm text-slate-300">
            Procesamos los cobros mediante Mercado Pago o Stripe. Pronto podrás habilitar débito automático y transferencias recurrentes desde esta misma pantalla.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>✔️ Factura electrónica en Argentina.</li>
            <li>✔️ Recordatorios automáticos para cuotas y presupuestos.</li>
            <li>✔️ Reportes contables descargables en CSV.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 shadow-lg shadow-cyan-500/20">
          <h3 className="text-lg font-semibold text-white">¿Necesitás ampliar tu plan?</h3>
          <p className="mt-2 text-sm text-cyan-100">
            Si superaste el límite de pacientes o querés sumar más sucursales, escribinos y armamos una propuesta a medida.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="mailto:hola@dentalist.com"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Contactar ventas
            </Link>
            <Link
              href="https://wa.me/5491156754321?text=Consulta%20sobre%20planes%20Dentalist"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:text-cyan-100"
            >
              WhatsApp comercial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
