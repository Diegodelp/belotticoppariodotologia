import Link from 'next/link';

const features = [
  {
    title: 'Agenda inteligente',
    description:
      'Sincronizá tu calendario, confirmá asistencia con un clic y recibí recordatorios automáticos.',
  },
  {
    title: 'Ficha clínica 360°',
    description:
      'Historial odontológico completo, tratamientos, pagos y archivos en un solo lugar.',
  },
  {
    title: 'Indicadores en tiempo real',
    description:
      'Seguimiento de productividad, cobranzas y evolución de tu consultorio en dashboards interactivos.',
  },
];

export default function Home() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.3),transparent_50%)]" />

      <header className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-24 sm:px-12">
        <nav className="flex items-center justify-between text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-wide text-cyan-300">
              Dentalist
            </span>
            <span className="hidden sm:block">Gestión inteligente para odontología</span>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-white/10 px-4 py-2 font-medium text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            Ingresar
          </Link>
        </nav>

        <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
              Plataforma APP - Dentalist
            </span>
            <h1 className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
              Todo el consultorio en un solo flujo digital
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              Organizá pacientes, turnos, tratamientos y pagos desde una experiencia
              diseñada para el equipo odontológico. Integrá recordatorios automatizados,
              indicadores de negocio y colaborá en tiempo real con tu staff.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-full bg-cyan-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
              >
                Crear cuenta profesional
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-6 py-3 font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
              >
                Probar demo interactiva
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span>✅ Recordatorios automáticos por WhatsApp y mail</span>
              <span>✅ Alertas de cobranzas y saldos pendientes</span>
              <span>✅ Seguimiento clínico multidisciplinario</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-cyan-500/40 via-white/5 to-transparent blur-3xl" />
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-cyan-200">
                <span>Tablero Dentalist</span>
                <span>{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10">
                  <p className="text-sm text-slate-400">Pacientes activos</p>
                  <p className="mt-2 text-3xl font-semibold text-white">128</p>
                  <p className="mt-1 text-xs text-emerald-400">+12% vs. mes anterior</p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10">
                  <p className="text-sm text-slate-400">Turnos confirmados</p>
                  <p className="mt-2 text-3xl font-semibold text-white">32</p>
                  <p className="mt-1 text-xs text-cyan-300">Próximas 48 hs</p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10">
                  <p className="text-sm text-slate-400">Facturación del mes</p>
                  <p className="mt-2 text-3xl font-semibold text-white">$2,4M</p>
                  <p className="mt-1 text-xs text-emerald-400">Cobrado 78%</p>
                </div>
                <div className="rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10">
                  <p className="text-sm text-slate-400">Alertas críticas</p>
                  <p className="mt-2 text-3xl font-semibold text-white">3</p>
                  <p className="mt-1 text-xs text-amber-300">Seguimientos pendientes</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                Dentalist aplica IA para sugerirte disponibilidad óptima, alertar faltas de stock y anticipar atrasos en cobranzas.
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="border-t border-white/5 bg-slate-950/70 py-16 backdrop-blur">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:px-12 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 shadow-lg shadow-cyan-500/10"
            >
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/80 py-10 text-sm text-slate-400 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Dentalist. Transformamos la gestión odontológica.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-cyan-200">
              Acceder
            </Link>
            <Link href="/register" className="hover:text-cyan-200">
              Crear cuenta
            </Link>
            <a href="mailto:hola@dentalist.com" className="hover:text-cyan-200">
              Contacto comercial
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
