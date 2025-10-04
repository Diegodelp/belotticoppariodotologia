import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketing | Dentalist',
  description:
    'Panel de marketing con insights de IA, pruebas para WhatsApp Business e ideas de contenido para Instagram.',
};

const insightHighlights = [
  {
    title: 'Proyección de facturación',
    metric: '$1.240.000',
    subtitle: 'Ingresos estimados próximos 30 días',
    trend: '+18% vs. último mes',
  },
  {
    title: 'Costo promedio por adquisición',
    metric: '$3.450',
    subtitle: 'Campañas activas en Instagram Ads',
    trend: '-7% en la última semana',
  },
  {
    title: 'Conversión en WhatsApp',
    metric: '32%',
    subtitle: 'Consultas que terminaron en turno reservado',
    trend: '+5 pts tras la campaña de urgencias',
  },
];

const aiIdeas = [
  {
    heading: 'Campaña de blanqueamiento',
    copy:
      'Destacá testimonios antes y después, ofrecé un 15% de descuento para reservas esta semana y recordá que el cupo es limitado.',
    callToAction: 'CTA sugerido: “Reservá tu evaluación gratuita”',
  },
  {
    heading: 'Seguimiento post-tratamiento',
    copy:
      'Automatizá mensajes de control a los 7 y 21 días con recomendaciones personalizadas y link directo para reagendar si es necesario.',
    callToAction: 'CTA sugerido: “Coordiná tu control online”',
  },
  {
    heading: 'Promoción de ortodoncia invisible',
    copy:
      'Explicá el proceso en 3 pasos, sumá video corto del laboratorio aliado y un caso real con resultados medibles.',
    callToAction: 'CTA sugerido: “Quiero mi plan digital”',
  },
];

const whatsappPlaybook = [
  {
    title: 'Secuencia de bienvenida',
    items: [
      'Mensaje inicial con horario de respuesta y link al formulario de pre-diagnóstico.',
      'Recordatorio automático a las 2 hs con disponibilidad de turnos próximos.',
      'Escalado a asistente humano si no hay respuesta en 6 hs.',
    ],
  },
  {
    title: 'Campaña de urgencias',
    items: [
      'Lista segmentada de pacientes con tratamientos pendientes.',
      'Plantilla rápida con botón “Necesito asistencia” y derivación directa a guardia.',
      'Registro de cada contacto en el historial clínico del paciente.',
    ],
  },
  {
    title: 'Recordatorios de pagos',
    items: [
      'Aviso 48 hs antes del vencimiento con link a Mercado Pago.',
      'Mensaje de agradecimiento automático al registrarse el pago.',
      'Alertas internas para el equipo de cobranzas si hay mora >5 días.',
    ],
  },
];

const instagramIdeas = [
  {
    category: 'Historias destacadas',
    description:
      'Agrupá testimonios, turnos disponibles y detrás de escena del consultorio para generar confianza en nuevos pacientes.',
  },
  {
    category: 'Reels educativos',
    description:
      'Clips de 30 segundos con tips de higiene, explicación de tratamientos y respuestas rápidas a preguntas frecuentes.',
  },
  {
    category: 'Feed promocional',
    description:
      'Template semanal con antes/después, porcentaje de descuento y botón para reservar turno directamente desde la bio.',
  },
];

export default function MarketingPage() {
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Marketing y crecimiento</h1>
          <p className="text-sm text-slate-300">
            Organizá tus ideas antes de conectar Meta: trabajá con datos de ejemplo y pedile a la IA que sugiera próximas campañas.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {insightHighlights.map((insight) => (
            <article
              key={insight.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10"
            >
              <p className="text-sm text-slate-300">{insight.title}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{insight.metric}</p>
              <p className="mt-2 text-xs text-slate-400">{insight.subtitle}</p>
              <p className="mt-3 text-xs font-medium text-emerald-300">{insight.trend}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-lg shadow-cyan-500/10 lg:col-span-2">
          <h2 className="text-xl font-semibold text-white">Insights generados por IA</h2>
          <p className="mt-2 text-sm text-slate-300">
            Este panel usa métricas ficticias para que experimentes con prompts y ajustes de objetivos antes de integrar tus fuentes reales.
          </p>
          <ul className="mt-4 space-y-4 text-sm text-slate-200">
            {aiIdeas.map((idea) => (
              <li key={idea.heading} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <h3 className="text-base font-semibold text-white">{idea.heading}</h3>
                <p className="mt-2 text-slate-300">{idea.copy}</p>
                <p className="mt-3 text-xs font-medium text-cyan-200">{idea.callToAction}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <article className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6 shadow-lg shadow-cyan-500/20">
            <h2 className="text-xl font-semibold text-white">WhatsApp (borrador)</h2>
            <p className="mt-2 text-sm text-cyan-100">
              Define scripts, tiempos y responsables antes de conectar con un BSP o la API oficial de Meta.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {whatsappPlaybook.map((block) => (
                <div key={block.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <h3 className="text-sm font-semibold text-white">{block.title}</h3>
                  <ul className="mt-3 space-y-2 text-xs text-slate-200">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-cyan-300">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-lg shadow-rose-500/20">
            <h2 className="text-xl font-semibold text-white">Instagram (borrador)</h2>
            <p className="mt-2 text-sm text-rose-100">
              Planificá publicaciones, reels y colaboraciones con datos simulados mientras preparás la conexión con Meta.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {instagramIdeas.map((idea) => (
                <div key={idea.category} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white">{idea.category}</h3>
                  <p className="mt-2 text-xs text-slate-200 leading-relaxed">{idea.description}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-rose-200">Plantillas disponibles en breve</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <h2 className="text-xl font-semibold text-white">Checklist previo a integrar Meta</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-200">
          <li>
            <span className="font-semibold text-white">1.</span> Verificá tu cuenta de negocio y reuní documentación legal (AFIP, habilitaciones, contratos de servicio).
          </li>
          <li>
            <span className="font-semibold text-white">2.</span> Definí responsables internos: quién responde WhatsApp, quién aprueba creatividades y quién analiza resultados.
          </li>
          <li>
            <span className="font-semibold text-white">3.</span> Configurá dominios y políticas de privacidad (incluyendo la de Meta) antes de enviar tus campañas a revisión.
          </li>
          <li>
            <span className="font-semibold text-white">4.</span> Probá plantillas y bots con estos datos de ejemplo para validar tiempos de respuesta y experiencia del paciente.
          </li>
        </ol>
      </section>
    </div>
  );
}
