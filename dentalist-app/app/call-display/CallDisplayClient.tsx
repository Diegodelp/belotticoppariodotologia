"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/hooks/useAuth';
import { AppointmentService } from '@/services/appointment.service';
import { ClinicService } from '@/services/clinic.service';
import { isProPlan } from '@/lib/utils/subscription';
import { Appointment, Clinic } from '@/types';

interface CallDisplayData {
  appointment: (Appointment & { calledBox?: string | null }) | null;
  patient?: {
    id: string;
    name: string;
    lastName: string;
    clinicId?: string | null;
    clinicName?: string | null;
  } | null;
  error?: string;
}

export function CallDisplayClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialClinicParam = searchParams.get('clinicId');
  const hasAttendanceFeature = isProPlan(user?.subscriptionPlan ?? null);
  const [selectedClinic, setSelectedClinic] = useState<string>(initialClinicParam ?? 'all');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [data, setData] = useState<CallDisplayData>({ appointment: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminProfessional = useMemo(
    () => user?.type === 'profesional' && (!user.ownerProfessionalId || user.teamRole === 'admin'),
    [user],
  );

  const isTeamRestricted = useMemo(
    () => Boolean(user?.ownerProfessionalId && user.teamRole !== 'admin'),
    [user],
  );

  useEffect(() => {
    if (!user || !hasAttendanceFeature) {
      return;
    }

    if (isTeamRestricted) {
      setSelectedClinic(user.teamClinicId ?? 'all');
    }
  }, [hasAttendanceFeature, isTeamRestricted, user]);

  useEffect(() => {
    let cancelled = false;

    const fetchClinics = async () => {
      if (!isAdminProfessional || !hasAttendanceFeature) {
        return;
      }
      try {
        const response = await ClinicService.list();
        if (!cancelled) {
          setClinics(response);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error('No pudimos obtener los consultorios', fetchError);
        }
      }
    };

    fetchClinics();

    return () => {
      cancelled = true;
    };
  }, [hasAttendanceFeature, isAdminProfessional]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        if (!hasAttendanceFeature) {
          setLoading(false);
          setError('La pantalla de llamados está disponible para los planes Pro y Enterprise.');
          return;
        }
        setLoading(true);
        setError(null);
        const params: Record<string, string | undefined> = {};
        if (selectedClinic && selectedClinic !== 'all') {
          params.clinicId = selectedClinic;
        }
        const response = await AppointmentService.latestCall(params);
        if (!cancelled) {
          setData(response as CallDisplayData);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error('No pudimos obtener el llamado actual', fetchError);
          setError('No pudimos actualizar la información del llamado.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!hasAttendanceFeature) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasAttendanceFeature, selectedClinic]);

  const activeClinicName = useMemo(() => {
    if (selectedClinic === 'all') {
      return null;
    }
    const match = clinics.find((clinic) => clinic.id === selectedClinic);
    return match?.name ?? data.patient?.clinicName ?? null;
  }, [clinics, data.patient?.clinicName, selectedClinic]);

  const patientDisplayName = useMemo(() => {
    if (!data.patient) {
      return null;
    }
    const fullName = `${data.patient.name} ${data.patient.lastName}`.trim();
    return fullName || data.patient.name || data.patient.lastName || null;
  }, [data.patient]);

  const calledTime = useMemo(() => {
    if (!data.appointment?.calledAt) {
      return null;
    }
    return new Date(data.appointment.calledAt).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [data.appointment?.calledAt]);

  if (!hasAttendanceFeature) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-center text-slate-200">
        <div className="max-w-xl space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-cyan-500/10">
          <h1 className="text-2xl font-semibold text-white">Función disponible en planes Pro y Enterprise</h1>
          <p className="text-sm text-slate-300">
            Activá un plan superior para proyectar la pantalla de llamados, registrar asistencia y anunciar pacientes en vivo.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <a
              className="rounded-full bg-cyan-500 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
              href="/billing"
            >
              Ver planes disponibles
            </a>
            <a
              className="rounded-full border border-white/20 px-5 py-2 font-semibold text-white hover:border-white/40"
              href="/pricing"
            >
              Conocer más sobre Dentalist Pro
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-screen flex-col bg-slate-950 px-6 py-10 text-white">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Pantalla de llamados</h1>
          <p className="text-sm text-slate-300">
            Mostrá en la sala de espera el próximo paciente y el box que debe dirigirse.
          </p>
        </div>
        {isAdminProfessional && clinics.length > 0 && (
          <label className="flex flex-col text-xs text-slate-200">
            <span className="font-semibold uppercase tracking-[0.2em] text-slate-400">Consultorio</span>
            <select
              value={selectedClinic}
              onChange={(event) => setSelectedClinic(event.target.value)}
              className="mt-1 min-w-[220px] rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-white focus:border-cyan-300 focus:outline-none"
            >
              <option value="all">Todos</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-cyan-500/10">
          {loading && <p className="text-lg text-slate-300">Actualizando información...</p>}
          {!loading && error && <p className="text-lg text-rose-300">{error}</p>}
          {!loading && !error && !data.appointment && (
            <div className="space-y-4">
              <p className="text-2xl font-semibold text-slate-200">Aún no se llamó a ningún paciente.</p>
              <p className="text-sm text-slate-400">
                Cuando un profesional anuncie a un paciente desde el calendario, aparecerá automáticamente aquí.
              </p>
            </div>
          )}
          {!loading && !error && data.appointment && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Paciente</p>
                <p className="text-4xl font-bold text-white sm:text-5xl">
                  {patientDisplayName ?? 'Paciente reservado'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">Dirigirse al box</p>
                <p className="text-5xl font-black text-cyan-200 sm:text-6xl">
                  {data.appointment.calledBox ?? '—'}
                </p>
              </div>
              <div className="space-y-1 text-sm text-slate-300">
                {activeClinicName && <p>Consultorio: {activeClinicName}</p>}
                {calledTime && <p>Anunciado a las {calledTime} hs</p>}
                {!calledTime && data.appointment?.date && data.appointment?.time && (
                  <p>
                    Turno: {new Date(`${data.appointment.date}T${data.appointment.time}`).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    hs
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
