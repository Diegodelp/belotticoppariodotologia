'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PatientService } from '@/services/patient.service';
import { Appointment, Patient, Payment, Treatment } from '@/types';

interface PatientDetailResponse {
  patient: Patient;
  appointments: Appointment[];
  treatments: Treatment[];
  payments: Payment[];
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await PatientService.getById(params.id);
        if (response?.patient) {
          setData(response as PatientDetailResponse);
        } else {
          throw new Error('Paciente no encontrado');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return <p className="px-8 py-6 text-sm text-slate-300">Cargando información del paciente...</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-6 px-8 py-6">
        <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error ?? 'Paciente no encontrado'}</p>
        <button
          onClick={() => router.push('/patients')}
          className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-300 hover:text-cyan-200"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  const { patient, appointments, treatments, payments } = data;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            {patient.name} {patient.lastName}
          </h1>
          <p className="text-sm text-slate-300">DNI {patient.dni} • {patient.healthInsurance || 'Particular'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/patients/${patient.id}?edit=true`}
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Editar datos
          </Link>
          <Link
            href={`/calendar?patientId=${patient.id}`}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Agendar turno
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <h2 className="text-lg font-semibold text-white">Datos de contacto</h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <div>
                <dt className="text-slate-400">Email</dt>
                <dd>{patient.email || 'Sin correo registrado'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Teléfono</dt>
                <dd>{patient.phone || 'Sin teléfono cargado'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Dirección</dt>
                <dd>{patient.address || 'Sin dirección'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Estado</dt>
                <dd>
                  <span className={`rounded-full px-3 py-1 text-xs ${patient.status === 'active' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40' : 'bg-amber-500/10 text-amber-200 border border-amber-400/40'}`}>
                    {patient.status === 'active' ? 'Activo en seguimiento' : 'Seguimiento pausado'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Historial de tratamientos</h2>
              <Link href={`/treatments?patientId=${patient.id}`} className="text-xs text-cyan-200 hover:underline">
                Ver todo
              </Link>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              {treatments.length === 0 && (
                <p className="text-slate-400">Todavía no hay tratamientos registrados.</p>
              )}
              {treatments.map((treatment) => (
                <div key={treatment.id} className="rounded-2xl bg-slate-900/60 px-4 py-3">
                  <p className="font-medium text-white">{treatment.type}</p>
                  <p className="text-xs text-slate-400">{treatment.date}</p>
                  <p className="mt-1 text-sm text-slate-300">{treatment.description}</p>
                  <p className="mt-2 text-xs text-emerald-300">
                    Monto: {treatment.cost.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Pagos registrados</h2>
              <Link href={`/payments?patientId=${patient.id}`} className="text-xs text-cyan-200 hover:underline">
                Gestionar cobranzas
              </Link>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              {payments.length === 0 && (
                <p className="text-slate-400">No hay pagos cargados.</p>
              )}
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">
                      {payment.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </p>
                    <p className="text-xs text-slate-400">{new Date(payment.date).toLocaleDateString('es-AR')}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      payment.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
                        : 'bg-amber-500/10 text-amber-200 border border-amber-400/40'
                    }`}
                  >
                    {payment.status === 'completed' ? 'Cobrado' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <h2 className="text-lg font-semibold text-white">Próximos turnos</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              {appointments.length === 0 && (
                <p className="text-slate-400">No hay turnos programados.</p>
              )}
              {appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl bg-slate-900/60 px-4 py-3">
                  <p className="font-medium text-white">{appointment.type}</p>
                  <p className="text-xs text-slate-400">
                    {appointment.date} • {appointment.time}
                  </p>
                  <p className="mt-2 text-xs text-cyan-200 capitalize">Estado: {appointment.status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-cyan-500/10 p-6 text-sm text-cyan-50 shadow-lg shadow-cyan-500/20">
            <h2 className="text-lg font-semibold text-white">Recordatorios automáticos</h2>
            <p className="mt-3 text-cyan-100">
              Activá recordatorios por WhatsApp y mail para confirmar asistencia y enviar enlaces de pago previos al turno.
            </p>
            <button className="mt-4 w-full rounded-full border border-cyan-300/60 px-4 py-2 text-xs font-semibold text-cyan-100 hover:border-white/80">
              Configurar automatizaciones
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}