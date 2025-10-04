import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Políticas de Privacidad | Dentalist',
  description:
    'Conocé cómo protegemos los datos clínicos, comerciales y de comunicación de profesionales y pacientes en Dentalist.',
};

const sections = [
  {
    title: '1. Alcance y responsables',
    content:
      'Esta política aplica a la plataforma Dentalist (web y APIs) utilizada por profesionales odontológicos y sus pacientes. Dentalist opera como encargado del tratamiento y firma acuerdos de confidencialidad con cada profesional, quien actúa como responsable primario de los datos de sus pacientes.',
  },
  {
    title: '2. Datos que recopilamos',
    content:
      'Registramos información de identificación (nombre, DNI, datos de contacto), antecedentes clínicos, imágenes diagnósticas, presupuestos, turnos, transacciones y métricas financieras que el profesional carga manualmente o mediante integraciones autorizadas.',
  },
  {
    title: '3. Uso de la información',
    content:
      'Los datos se emplean para gestionar historias clínicas, generar recetas y presupuestos en PDF, coordinar turnos, emitir recordatorios de pagos, producir tableros de negocio y habilitar automatizaciones de mensajería cuando el profesional así lo configura.',
  },
  {
    title: '4. Almacenamiento y seguridad',
    content:
      'Toda la información se guarda en Supabase (PostgreSQL + Storage) con cifrado en reposo y tránsito. Implementamos Row Level Security por profesional, rotación de credenciales, copias de seguridad diarias y monitoreo de accesos. Las URLs firmadas de archivos expiran automáticamente en 15 minutos.',
  },
  {
    title: '5. Acceso y controles',
    content:
      'Cada profesional administra el alta/baja de pacientes y colaboradores. Dentalist provee autenticación por contraseña, segundo factor opcional por correo y auditoría básica. El paciente puede solicitar la actualización o eliminación de su información contactando directamente a su profesional.',
  },
  {
    title: '6. Integraciones de mensajería (WhatsApp y SMS)',
    content:
      'Mientras no se habilite Meta, trabajamos con datos de prueba y proveedores externos seleccionados por cada profesional. Una vez conectada la API oficial, los mensajes se envían con plantillas aprobadas, registro de consentimiento y logs de conversación asociados al historial clínico.',
  },
  {
    title: '7. Integraciones de redes sociales (Instagram y Meta Ads)',
    content:
      'Los borradores y recomendaciones de IA se generan internamente sin publicar contenido automático. Cuando se conecte Meta, se respetarán las políticas de la plataforma: permisos mínimos necesarios, revisión de campañas y almacenamiento de tokens cifrado. Los profesionales deciden qué métricas monetarias comparten.',
  },
  {
    title: '8. Inteligencia artificial e insights',
    content:
      'Las funciones de IA operan sobre datos anonimizados o conjuntos de prueba, generando recomendaciones para marketing y seguimiento clínico. Cualquier futura integración con modelos externos requerirá consentimiento previo y cláusulas específicas de tratamiento de datos.',
  },
  {
    title: '9. Calendario y servicios de Google',
    content:
      'El enlace con Google Calendar utiliza OAuth 2.0. Guardamos tokens de actualización cifrados y sólo se sincronizan eventos pertenecientes al profesional autenticado. No accedemos a correos ni archivos personales.',
  },
  {
    title: '10. Retención y eliminación',
    content:
      'Los registros clínicos se conservan según las regulaciones locales o hasta que el responsable solicite la eliminación. Al cerrar una cuenta profesional, todos los datos asociados se eliminan o anonimizan en un plazo máximo de 30 días, salvo obligaciones legales vigentes.',
  },
  {
    title: '11. Derechos de los pacientes',
    content:
      'Los pacientes pueden ejercer derechos de acceso, rectificación, actualización y supresión comunicándose con su profesional o escribiendo a privacidad@dentalist.com. Respondemos las solicitudes en un máximo de 10 días hábiles.',
  },
  {
    title: '12. Cambios en la política',
    content:
      'Publicaremos cualquier modificación relevante con al menos 7 días de anticipación. La fecha de última actualización se indicará al pie del documento y el uso continuado del servicio implicará la aceptación de los nuevos términos.',
  },
  {
    title: 'Contacto',
    content:
      'Para consultas sobre privacidad y cumplimiento escribinos a privacidad@dentalist.com o a nuestra oficina en Av. Salud 1234, Ciudad Autónoma de Buenos Aires.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(251,191,36,0.12),transparent_45%)]" />
      <section className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16 sm:px-12">
        <header className="space-y-4 text-center sm:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Dentalist
          </span>
          <h1 className="text-4xl font-semibold text-white">Políticas de Privacidad</h1>
          <p className="text-sm text-slate-300">
            Este documento describe cómo cuidamos la información clínica, comercial y de comunicación utilizada en la plataforma Dentalist.
          </p>
        </header>

        <div className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-cyan-500/10">
          {sections.map((section) => (
            <article key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <p className="text-sm leading-relaxed text-slate-200">{section.content}</p>
            </article>
          ))}
        </div>

        <footer className="text-xs text-slate-400">
          Última actualización: {new Date().toLocaleDateString('es-AR')}
        </footer>
      </section>
    </main>
  );
}
