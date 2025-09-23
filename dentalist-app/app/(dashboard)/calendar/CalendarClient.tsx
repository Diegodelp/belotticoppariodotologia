"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { PatientService } from '@/services/patient.service';
import { Appointment, Patient } from '@/types';

interface AppointmentWithPatient extends Appointment {
  patient?: Patient;
}

export function CalendarClient() {
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

        {!loading &&
          Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="flex flex-col gap-2 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{new Date(date).toLocaleDateString('es-AR')}</p>
                  <h3 className="text-xl font-semibold text-white">{new Date(date).toLocaleDateString('es-AR', { weekday: 'long' })}</h3>
                </div>
                <p className="text-xs text-slate-400">
                  {items.length} turno{items.length === 1 ? '' : 's'} programado{items.length === 1 ? '' : 's'}
                </p>
              </div>
              <ul className="mt-4 space-y-3">
                {items.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition hover:border-cyan-300/40 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-200">
                        {appointment.time}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{appointment.patient?.fullName ?? 'Paciente sin asignar'}</p>
                        <p className="text-xs text-slate-300">{appointment.reason}</p>
                        {appointment.patient?.id && (
                          <Link
                            href={`/patients/${appointment.patient.id}`}
                            className="mt-1 inline-flex items-center text-xs font-semibold text-cyan-300 hover:text-cyan-100"
                          >
                            Ver ficha del paciente
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-3 py-1 font-semibold ${
                          appointment.status === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : appointment.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-200'
                            : appointment.status === 'cancelled'
                            ? 'bg-rose-500/20 text-rose-200'
                            : 'bg-slate-700/60 text-slate-200'
                        }`}
                      >
                        {appointment.status === 'confirmed'
                          ? 'Confirmado'
                          : appointment.status === 'pending'
                          ? 'Pendiente'
                          : appointment.status === 'cancelled'
                          ? 'Cancelado'
                          : 'Sin estado'}
                      </span>
                      <button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('appointmentId', appointment.id);
                          router.push(`/calendar?${params.toString()}`, { scroll: false });
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-100"
                      >
                        Reprogramar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
}

