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
        </div>
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

            <PatientCard key={patient.id} patient={patient} />

          ))}
        </div>
      </div>
    </section>
  );
}
