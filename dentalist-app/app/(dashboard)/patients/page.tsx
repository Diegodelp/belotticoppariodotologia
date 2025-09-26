'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PatientCard from '@/components/patients/PatientCard';
import { Patient } from '@/types';
import { PatientService } from '@/services/patient.service';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteAlert, setInviteAlert] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await PatientService.getAll();
        if (Array.isArray(response)) {
          setPatients(response as Patient[]);
        } else if (response?.patients) {
          setPatients(response.patients);
        }
      } catch {
        setError('No pudimos cargar los pacientes.');
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch = normalizedSearch
        ? `${patient.name} ${patient.lastName} ${patient.dni}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      const matchesStatus = status === 'all' ? true : patient.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [patients, search, status]);

  const handleDeletePatient = async (patientId: string) => {
    const patient = patients.find((item) => item.id === patientId);
    const confirmationMessage = patient
      ? `¿Seguro que querés eliminar a ${patient.name} ${patient.lastName}?`
      : '¿Seguro que querés eliminar este paciente?';

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      setError(null);
      setDeletingId(patientId);
      const response = await PatientService.remove(patientId);
      if (response?.error) {
        throw new Error(response.error);
      }
      setPatients((prev) => prev.filter((item) => item.id !== patientId));
    } catch (deleteError) {
      console.error('Error al eliminar paciente', deleteError);
      setError('No pudimos eliminar el paciente. Intentá nuevamente.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setInviteAlert(null);
    setInviteLink(null);
    setInviteExpiry(null);

    try {
      const response = await PatientService.createInvite();
      if (!response?.success || !response.inviteUrl) {
        throw new Error(response?.error ?? 'No pudimos generar el enlace de registro.');
      }

      const link: string = response.inviteUrl;
      const expiresAt: string | null = response.invite?.expiresAt ?? null;

      setInviteLink(link);
      setInviteExpiry(expiresAt);

      const expiryText = expiresAt
        ? ` Caduca el ${new Date(expiresAt).toLocaleString('es-AR')}.`
        : '';

      let successMessage = `Enlace generado correctamente.${expiryText}`;

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
          successMessage = `Enlace generado y copiado al portapapeles.${expiryText}`;
        } catch {
          successMessage = `Enlace generado. Copiá el enlace manualmente.${expiryText}`;
        }
      }

      setInviteAlert({ type: 'success', message: successMessage });
    } catch (generateError) {
      setInviteAlert({
        type: 'error',
        message:
          generateError instanceof Error
            ? generateError.message
            : 'No pudimos generar el enlace de registro.',
      });
      setInviteLink(null);
      setInviteExpiry(null);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      const expiryText = inviteExpiry
        ? ` Caduca el ${new Date(inviteExpiry).toLocaleString('es-AR')}.`
        : '';
      setInviteAlert({ type: 'success', message: `Enlace copiado al portapapeles.${expiryText}` });
    } catch {
      setInviteAlert({
        type: 'error',
        message: 'No pudimos copiar el enlace automáticamente. Copialo manualmente.',
      });
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Pacientes</h1>
          <p className="text-sm text-slate-300">
            Gestioná fichas clínicas, tratamientos y seguimientos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/patients/new"
            className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            + Nuevo paciente
          </Link>
          <Link
            href="/calendar"
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Ver agenda
          </Link>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            placeholder="Buscar por nombre o DNI"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 md:w-80"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3 py-2">
                <input
                  type="radio"
                  name="status"
                  value="all"
                  checked={status === 'all'}
                  onChange={() => setStatus('all')}
                />
                Todos
              </label>
              <label className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                />
                Activos
              </label>
              <label className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-2">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={status === 'inactive'}
                  onChange={() => setStatus('inactive')}
                />
                Inactivos
              </label>
            </div>
            <button
              type="button"
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
              className="w-full rounded-full border border-cyan-400/60 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {inviteLoading ? 'Generando enlace…' : 'Generar enlace de registro'}
            </button>
          </div>
        </div>
        {inviteAlert && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs ${
              inviteAlert.type === 'success'
                ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            <p>{inviteAlert.message}</p>
            {inviteLink && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="max-w-full truncate font-mono text-[13px] text-white/90">
                  {inviteLink}
                </span>
                {typeof navigator !== 'undefined' && navigator.clipboard?.writeText && (
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Copiar enlace
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {loading && <p className="text-sm text-slate-300">Cargando pacientes...</p>}
        {error && (
          <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
        {!loading && !error && filteredPatients.length === 0 && (
          <p className="rounded-2xl bg-slate-900/60 px-4 py-5 text-sm text-slate-300">
            No encontramos pacientes con los filtros actuales.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onDelete={() => handleDeletePatient(patient.id)}
              deleting={deletingId === patient.id}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
