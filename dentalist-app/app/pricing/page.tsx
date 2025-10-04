import Link from 'next/link';
import { PLAN_DEFINITIONS, PLAN_ORDER, TRIAL_DURATION_DAYS } from '@/lib/utils/subscription';

const planBenefits = [
  'Agenda inteligente con recordatorios automáticos',
  'Historia clínica, presupuestos y recetas digitales firmadas',
  'Integraciones con Google Calendar, WhatsApp y recordatorios por email',
  'Soporte técnico humano y capacitaciones sin cargo',
];

export default function PricingPage() {
  const plans = PLAN_ORDER.map((id) => PLAN_DEFINITIONS[id]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-24 sm:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.3),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.18),transparent_45%)]" />

        <header className="space-y-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Planes Dentalist
          </span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Invertí en tu consultorio, no en la burocracia</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Probá Dentalist sin compromiso durante {TRIAL_DURATION_DAYS} días. Podés migrar de plan en cualquier momento y solo pagás cuando estés listo para operar con pacientes reales.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-300">
            {planBenefits.map((benefit) => (
              <span key={benefit} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {benefit}
              </span>
            ))}
          </div>
        </header>

        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isStarter = plan.id === 'starter';
            const isPro = plan.id === 'pro';
            const isEnterprise = plan.id === 'enterprise';
            const cardStyle = isEnterprise
              ? 'border-amber-400/50 bg-amber-500/10 shadow-amber-500/30'
              : isPro
              ? 'border-cyan-400/50 bg-cyan-500/10 shadow-cyan-500/30'
              : 'border-white/10 bg-white/5 shadow-cyan-500/10';
            const badgeStyle = isEnterprise
              ? 'bg-amber-500/20 text-amber-100'
              : isPro
              ? 'bg-cyan-500/20 text-cyan-100'
              : 'bg-white/10 text-slate-200';
            const ctaHref = isStarter
              ? '/register'
              : isEnterprise
              ? 'mailto:hola@dentalist.com?subject=Quiero%20Dentalist%20Enterprise'
              : 'https://wa.me/5491156754321?text=Quiero%20Dentalist%20Pro';
            const ctaLabel = isStarter
              ? 'Crear cuenta y comenzar ahora'
              : isEnterprise
              ? 'Hablar con un especialista'
              : 'Agendar una demo personalizada';
            const ctaStyle = isStarter
              ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              : 'bg-white text-slate-950 hover:bg-slate-100';
            const footerCopy = isStarter
              ? `Prueba completa de ${TRIAL_DURATION_DAYS} días. No se requiere tarjeta de crédito para empezar.`
              : isEnterprise
              ? 'Incluye consultoría estratégica, personalizaciones y acuerdos de nivel de servicio.'
              : 'Incluye onboarding guiado, integraciones avanzadas y soporte prioritario 24/7.';
            return (
              <article
                key={plan.id}
                className={`flex h-full flex-col gap-6 rounded-3xl border p-8 shadow-xl transition ${cardStyle}`}
              >
                <div className="space-y-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${badgeStyle}`}
                  >
                    {plan.name}
                  </span>
                  <h2 className="text-2xl font-semibold text-white">{plan.headline}</h2>
                  <p className="text-sm text-slate-300">{plan.description}</p>
                  <p className="text-lg font-semibold text-cyan-100">{plan.priceLabel}</p>
                  <p className="text-xs text-cyan-200/80">{plan.highlight}</p>
                </div>
                <ul className="flex flex-1 flex-col gap-3 text-sm text-slate-200">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-cyan-300">{(!isStarter || feature.includes('ilimitad')) ? '✨' : '✅'}</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-3">
                  <Link
                    href={ctaHref}
                    className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${ctaStyle}`}
                  >
                    {ctaLabel}
                  </Link>
                  <p className={`text-xs ${isStarter ? 'text-slate-400' : 'text-slate-300'}`}>{footerCopy}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-200 shadow-lg shadow-cyan-500/10">
          <h2 className="text-lg font-semibold text-white">Preguntas frecuentes</h2>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-cyan-200">¿Qué pasa al terminar la prueba gratuita?</h3>
              <p className="mt-1 text-slate-300">
                Conservamos tus datos seguros. Si no activás un plan, el acceso del equipo queda en modo solo lectura y podés reactivar cuando quieras desde la sección de suscripción.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cyan-200">¿Puedo cambiar de plan más adelante?</h3>
              <p className="mt-1 text-slate-300">
                Sí. Podés pasar de Starter a Pro (o viceversa) en cualquier momento. El ajuste se prorratea automáticamente en el siguiente ciclo de facturación.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-cyan-200">¿Cómo se gestiona el pago?</h3>
              <p className="mt-1 text-slate-300">
                Utilizamos un proveedor de pagos seguro (Mercado Pago o Stripe) y emitimos factura electrónica. Pronto podrás abonar con débito automático o transferencia bancaria.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-8 text-center shadow-xl shadow-cyan-500/30">
          <h2 className="text-2xl font-semibold text-white">¿Listo para centralizar tu consultorio?</h2>
          <p className="mt-2 text-sm text-cyan-100">
            Activa tu prueba de {TRIAL_DURATION_DAYS} días y empezá a trabajar con turnos, pacientes y cobranzas en un mismo lugar.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
            >
              Crear cuenta gratuita
            </Link>
            <Link
              href="mailto:hola@dentalist.com"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:text-cyan-100"
            >
              Solicitar asesoramiento
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
