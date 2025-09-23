'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { Appointment, Patient } from '@/types';
import { PatientService } from '@/services/patient.service';

interface AppointmentWithPatient extends Appointment {
  patient?: Patient;
}

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
  const [showForm, setShowForm] = useState(false);
  const defaultPatientId = searchParams.get('patientId') ?? undefined;

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/appointments');
        const data = await response.json();
        setAppointments(data);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const response = await PatientService.getAll();
        if (Array.isArray(response)) {
          setPatients(response as Patient[]);
        } else if (Array.isArray(response?.patients)) {
          setPatients(response.patients as Patient[]);
        }
      } catch (error) {
        console.error('No pudimos obtener los pacientes', error);
      }
    };
    loadPatients();
  }, []);

  useEffect(() => {
    if (defaultPatientId) {
      setShowForm(true);
    }
  }, [defaultPatientId]);

  const filteredAppointments = useMemo(() => {
    const filtered =
      status === 'all'
        ? appointments
        : appointments.filter((appointment) => appointment.status === status);
    return filtered.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [appointments, status]);

  const groupedByDate = useMemo(() => {
    return filteredAppointments.reduce<Record<string, AppointmentWithPatient[]>>((acc, appointment) => {
      acc[appointment.date] = acc[appointment.date] ?? [];
      acc[appointment.date].push(appointment);
      return acc;
    }, {});
  }, [filteredAppointments]);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Calendario de turnos</h1>
          <p className="text-sm text-slate-300">
            Visualizá turnos confirmados, pendientes y reagendá con un clic.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setShowForm((previous) => !previous);
              if (defaultPatientId) {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('patientId');
                router.replace(`/calendar${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
              }
            }}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            {showForm ? 'Cerrar formulario' : 'Nuevo turno'}
          </button>
          <Link
            href="/patients"
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Ver pacientes
          </Link>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        {showForm && (
          <div className="rounded-3xl border border-cyan-300/40 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">Agendar nuevo turno</h2>
            <p className="mt-1 text-xs text-slate-300">
              Sincronizamos automáticamente con Google Calendar del correo del profesional.
            </p>
            <div className="mt-4">
              <AppointmentForm
                patients={patients}
                defaultPatientId={defaultPatientId}
                onCreated={(appointment, patient) => {
                  setAppointments((previous) => [
                    ...previous,
                    {
                      ...appointment,
                      patient,
                    },
                  ]);
                  setShowForm(false);
                  router.replace('/calendar', { scroll: false });
                }}
                onCancel={() => {
                  setShowForm(false);
                  router.replace('/calendar', { scroll: false });
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
          {(['all', 'confirmed', 'pending', 'cancelled'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full border px-4 py-2 capitalize transition ${
                status === value
                  ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                  : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-200'
              }`}
            >
              {value === 'all' ? 'Todos' : value}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando turnos...</p>}

        {!loading && Object.keys(groupedByDate).length === 0 && (
          <p className="rounded-2xl bg-slate-900/60 px-4 py-5 text-sm text-slate-300">
            No hay turnos programados con los filtros seleccionados.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                {new Date(date).toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-100">
                {items.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-cyan-500/10"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{appointment.type}</p>
                      <span className="text-xs text-cyan-200">{appointment.time} hs</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {appointment.patient?.name} {appointment.patient?.lastName}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Estado: {appointment.status}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}