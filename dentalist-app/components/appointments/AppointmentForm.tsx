'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Appointment, Clinic, Patient } from '@/types';
import { AppointmentService } from '@/services/appointment.service';

interface AppointmentFormProps {
  patients: Patient[];
  defaultPatientId?: string;
  appointment?: Appointment;
  mode?: 'create' | 'edit';
  clinics?: Clinic[];
  onCreated?: (appointment: Appointment, patient?: Patient) => void;
  onUpdated?: (appointment: Appointment, patient?: Patient) => void;
  onCancel?: () => void;
}

const defaultStatus: Appointment['status'] = 'confirmed';

export function AppointmentForm({
  patients,
  defaultPatientId,
  appointment,
  mode = 'create',
  clinics,
  onCreated,
  onUpdated,
  onCancel,
}: AppointmentFormProps) {
  const [patientId, setPatientId] = useState(
    appointment?.patientId ?? defaultPatientId ?? '',
  );
  const [date, setDate] = useState(appointment?.date ?? '');
  const [time, setTime] = useState(appointment?.time ?? '');
  const [type, setType] = useState(appointment?.type ?? 'Consulta de control');
  const [status, setStatus] = useState<Appointment['status']>(
    appointment?.status ?? defaultStatus,
  );
  const [clinicId, setClinicId] = useState(appointment?.clinicId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (defaultPatientId && !appointment) {
      setPatientId(defaultPatientId);
      const defaultPatient = patients.find((item) => item.id === defaultPatientId);
      if (defaultPatient?.clinicId) {
        setClinicId(defaultPatient.clinicId);
      }
    }
  }, [defaultPatientId, appointment, patients]);

  useEffect(() => {
    if (appointment && mode === 'edit') {
      setPatientId(appointment.patientId);
      setDate(appointment.date);
      setTime(appointment.time);
      setType(appointment.type);
      setStatus(appointment.status);
      setClinicId(appointment.clinicId ?? '');
    }
  }, [appointment, mode]);

  const patientOptions = useMemo(() => {
    return [...patients].sort((a, b) => a.name.localeCompare(b.name));
  }, [patients]);

  const clinicOptions = useMemo(() => clinics ?? [], [clinics]);

  const selectedPatient = useMemo(() => {
    return patientOptions.find((item) => item.id === patientId);
  }, [patientId, patientOptions]);

  useEffect(() => {
    if (mode === 'create') {
      const patientClinic = selectedPatient?.clinicId ?? '';
      const fallbackClinic =
        patientClinic || (clinicOptions.length === 1 ? clinicOptions[0].id : '');
      setClinicId((previous) => (fallbackClinic === previous ? previous : fallbackClinic));
    }
  }, [clinicOptions, mode, selectedPatient?.clinicId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!patientId || !date || !time || !type) {
      setError('Completá paciente, fecha, horario y motivo del turno.');
      return;
    }

    try {
      setLoading(true);
      const selectedPatient = patientOptions.find((item) => item.id === patientId);

      const normalizedClinicId = clinicId && clinicId.length > 0 ? clinicId : undefined;

      if (mode === 'edit' && appointment) {
        const response = await AppointmentService.update(appointment.id, {
          patientId,
          date,
          time,
          type,
          status,
          clinicId: normalizedClinicId ?? null,
        });

        if (!response?.success) {
          throw new Error(response?.error ?? 'No pudimos actualizar el turno.');
        }

        onUpdated?.(response.appointment as Appointment, selectedPatient);
        setSuccess(true);
      } else {
        const response = await AppointmentService.create({
          patientId,
          date,
          time,
          type,
          status,
          clinicId: normalizedClinicId ?? null,
        });

        if (!response?.success) {
          throw new Error(response?.error ?? 'No pudimos agendar el turno.');
        }

        onCreated?.(response.appointment as Appointment, selectedPatient);
        setSuccess(true);
        setDate('');
        setTime('');
        setType('Consulta de control');
        setStatus(defaultStatus);
        const fallbackClinic =
          selectedPatient?.clinicId ?? (clinicOptions.length === 1 ? clinicOptions[0].id : '');
        setClinicId(fallbackClinic ?? '');
      }
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Paciente
          <select
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="" disabled>
              Seleccioná un paciente
            </option>
            {patientOptions.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} {patient.lastName} • DNI {patient.dni}
              </option>
            ))}
          </select>
        </label>

        {clinicOptions.length > 0 && (
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
            Consultorio
            <select
              value={clinicId}
              onChange={(event) => setClinicId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {clinicOptions.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Hora
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Estado
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Appointment['status'])}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="confirmed">Confirmado</option>
            <option value="pending">Pendiente</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-300">
        Motivo
        <input
          value={type}
          onChange={(event) => setType(event.target.value)}
          placeholder="Ej: Control mensual"
          className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
        />
      </label>

      {error && <p className="rounded-2xl bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{error}</p>}
      {success && (
        <p className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
          {mode === 'edit'
            ? 'Turno actualizado correctamente.'
            : 'Turno agendado y sincronizado con Google Calendar.'}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? mode === 'edit'
              ? 'Guardando...'
              : 'Agendando...'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Agendar turno'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
