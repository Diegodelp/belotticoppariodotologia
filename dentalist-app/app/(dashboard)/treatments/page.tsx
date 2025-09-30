'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TreatmentService } from '@/services/treatment.service';
import { Clinic, Treatment, Patient } from '@/types';
import { TeamService } from '@/services/team.service';
import { useAuth } from '@/hooks/useAuth';

interface TreatmentWithPatient extends Treatment {
  patient?: Patient;
}

const getToday = () => new Date().toISOString().split('T')[0];

const createEmptyForm = () => ({
  patientId: '',
  type: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  cost: '',
});

type ModalMode = 'create' | 'edit';

export default function TreatmentsPage() {
  const { user } = useAuth();
  const [treatments, setTreatments] = useState<TreatmentWithPatient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [fromDate, setFromDate] = useState<string>(() => getToday());
  const [toDate, setToDate] = useState<string>(() => getToday());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [form, setForm] = useState(() => createEmptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicFilter, setClinicFilter] = useState<'all' | '__none__' | string>('all');
  const isAdminProfessional =
    user?.type === 'profesional' && (!user.ownerProfessionalId || user.teamRole === 'admin');

  useEffect(() => {
    let active = true;

    const fetchTreatments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/treatments', { credentials: 'include' });
        if (!active) return;
        const data = (await response.json()) as TreatmentWithPatient[];
        setTreatments(data);
      } catch (error) {
        console.error('Error al cargar tratamientos', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const fetchPatients = async () => {
      try {
        setPatientsLoading(true);
        const response = await fetch('/api/patients', { credentials: 'include' });
        if (!active) return;
        const data = (await response.json()) as Patient[];
        setPatients(data);
        setForm((prev) => ({
          ...prev,
          patientId: prev.patientId || data[0]?.id || '',
        }));
      } catch (error) {
        console.error('Error al cargar pacientes', error);
      } finally {
        if (active) {
          setPatientsLoading(false);
        }
      }
    };

    fetchTreatments();
    fetchPatients();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!user || user.type !== 'profesional' || user.subscriptionPlan !== 'pro' || !isAdminProfessional) {
      setClinics([]);
      setClinicFilter('all');
      return () => {
        active = false;
      };
    }

    const fetchClinics = async () => {
      try {
        setClinicsLoading(true);
        const overview = await TeamService.getOverview();
        if (!active) return;
        setClinics(overview.clinics);
      } catch (error) {
        console.error('Error al cargar consultorios', error);
        if (active) {
          setClinics([]);
        }
      } finally {
        if (active) {
          setClinicsLoading(false);
        }
      }
    };

    fetchClinics();

    return () => {
      active = false;
    };
  }, [user, isAdminProfessional]);

  useEffect(() => {
    if (clinicFilter === 'all' || clinicFilter === '__none__') {
      return;
    }
    if (!clinics.some((clinic) => clinic.id === clinicFilter)) {
      setClinicFilter('all');
    }
  }, [clinicFilter, clinics]);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient] as [string, Patient])),
    [patients],
  );

  const enableClinicFilter =
    isAdminProfessional && user?.subscriptionPlan === 'pro' && clinics.length > 1;
  const hasUnassignedPatients = useMemo(
    () => isAdminProfessional && patients.some((patient) => !patient.clinicId),
    [isAdminProfessional, patients],
  );

  const filteredTreatments = useMemo(() => {
    const search = filter.trim().toLowerCase();
    const selectedClinicId = clinicFilter !== 'all' && clinicFilter !== '__none__' ? clinicFilter : null;
    return treatments.filter((treatment) => {
      const normalizedDate = treatment.date.split('T')[0];
      if (fromDate && normalizedDate < fromDate) {
        return false;
      }
      if (toDate && normalizedDate > toDate) {
        return false;
      }
      if (enableClinicFilter) {
        if (clinicFilter === '__none__') {
          if (treatment.patient?.clinicId) {
            return false;
          }
        } else if (clinicFilter !== 'all') {
          if (!selectedClinicId) {
            return false;
          }
          if (treatment.patient?.clinicId !== selectedClinicId) {
            return false;
          }
        }
      }
      if (!search) {
        return true;
      }
      return `${treatment.type} ${treatment.description}`.toLowerCase().includes(search);
    });
  }, [filter, fromDate, toDate, treatments, enableClinicFilter, clinicFilter]);

  const totalRevenue = filteredTreatments.reduce((acc, treatment) => acc + treatment.cost, 0);

  const openCreateModal = () => {
    setModalMode('create');
    setForm((prev) => ({ ...createEmptyForm(), patientId: prev.patientId }));
    setFormError(null);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (treatment: TreatmentWithPatient) => {
    setModalMode('edit');
    setEditingId(treatment.id);
    setForm({
      patientId: treatment.patientId,
      type: treatment.type,
      description: treatment.description,
      date: treatment.date,
      cost: treatment.cost.toString(),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setForm(createEmptyForm());
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const trimmedType = form.type.trim();
    const trimmedDescription = form.description.trim();
    const amount = Number(form.cost);

    if (!form.patientId || !trimmedType || !trimmedDescription || !form.date || Number.isNaN(amount)) {
      setFormError('Completá todos los campos con valores válidos.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (modalMode === 'edit' && editingId) {
        const response = await TreatmentService.update({
          id: editingId,
          type: trimmedType,
          description: trimmedDescription,
          cost: amount,
          date: form.date,
        });

        if (!response?.success || !response.treatment) {
          throw new Error(response?.error ?? 'No pudimos actualizar el tratamiento.');
        }

        const updatedTreatment = response.treatment;

        setTreatments((prev) =>
          prev.map((item) =>
            item.id === updatedTreatment.id
              ? { ...updatedTreatment, patient: patientMap.get(updatedTreatment.patientId) ?? item.patient }
              : item,
          ),
        );
      } else {
        const response = await TreatmentService.create({
          patientId: form.patientId,
          type: trimmedType,
          description: trimmedDescription,
          cost: amount,
          date: form.date,
        });

        if (!response?.success || !response.treatment) {
          throw new Error(response?.error ?? 'No pudimos registrar el tratamiento.');
        }

        const withPatient: TreatmentWithPatient = {
          ...response.treatment,
          patient: patientMap.get(response.treatment.patientId),
        };

        setTreatments((prev) => [withPatient, ...prev]);
      }

      closeModal();
    } catch (error) {
      console.error('Error al guardar tratamiento', error);
      setFormError(error instanceof Error ? error.message : 'No pudimos guardar el tratamiento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (treatment: TreatmentWithPatient) => {
    if (deleteId || !window.confirm('¿Seguro que deseas eliminar este tratamiento?')) {
      return;
    }

    try {
      setDeleteId(treatment.id);
      const response = await TreatmentService.remove(treatment.id);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el tratamiento.');
      }
      setTreatments((prev) => prev.filter((item) => item.id !== treatment.id));
      if (editingId === treatment.id) {
        closeModal();
      }
    } catch (error) {
      console.error('Error al eliminar tratamiento', error);
      alert(error instanceof Error ? error.message : 'No pudimos eliminar el tratamiento.');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Tratamientos</h1>
          <p className="text-sm text-slate-300">Monitor de procedimientos y costos por paciente.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Registrar tratamiento
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
            <input
              type="search"
              placeholder="Buscar tratamiento o descripción"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="w-full rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 md:max-w-sm"
            />
            <div className="flex w-full flex-col gap-3 text-xs text-slate-200 md:flex-row md:items-center">
              {enableClinicFilter && (
                <select
                  value={clinicFilter}
                  onChange={(event) => setClinicFilter(event.target.value as typeof clinicFilter)}
                  disabled={clinicsLoading}
                  className="w-full rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 md:w-56"
                >
                  <option value="all">Todos los consultorios</option>
                  {hasUnassignedPatients && <option value="__none__">Sin consultorio asignado</option>}
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex flex-1 items-center gap-2">
                <span className="hidden text-slate-300 md:inline">Desde</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  aria-label="Filtrar tratamientos desde"
                  className="w-full rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              </label>
              <label className="flex flex-1 items-center gap-2">
                <span className="hidden text-slate-300 md:inline">Hasta</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  aria-label="Filtrar tratamientos hasta"
                  className="w-full rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const today = getToday();
                  setFromDate(today);
                  setToDate(today);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-cyan-200"
              >
                Hoy
              </button>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-900/60 px-5 py-2 text-xs text-slate-200">
            Facturación estimada: {totalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </div>
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando tratamientos...</p>}

        <div className="overflow-x-auto">
          <div className="inline-block w-full min-w-full align-middle">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-[720px] w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Tratamiento</th>
                <th className="px-6 py-3">Descripción</th>
                <th className="px-6 py-3 text-right">Costo</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTreatments.map((treatment) => (
                <tr key={treatment.id} className="bg-slate-900/50">
                  <td className="px-6 py-4 text-slate-300">{treatment.date}</td>
                  <td className="px-6 py-4 text-slate-200">
                    {treatment.patient?.name} {treatment.patient?.lastName}
                  </td>
                  <td className="px-6 py-4 text-white">{treatment.type}</td>
                  <td className="px-6 py-4 text-slate-300">{treatment.description}</td>
                  <td className="px-6 py-4 text-right text-emerald-300">
                    {treatment.cost.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEditModal(treatment)}
                        className="rounded-full border border-white/15 px-3 py-1 font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(treatment)}
                        disabled={deleteId === treatment.id}
                        className="rounded-full border border-rose-400/40 px-3 py-1 font-semibold text-rose-200 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteId === treatment.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredTreatments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-300">
                    No encontramos tratamientos con los criterios seleccionados.
                  </td>
                </tr>
              )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-sm text-slate-100 shadow-2xl shadow-cyan-500/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {modalMode === 'edit' ? 'Editar tratamiento' : 'Registrar tratamiento'}
                </h2>
                <p className="text-xs text-slate-400">
                  Completá los detalles del procedimiento realizado.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                disabled={saving}
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Paciente
                  <select
                    value={form.patientId}
                    onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
                    disabled={modalMode === 'edit' || patientsLoading}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="" disabled>
                      {patientsLoading ? 'Cargando pacientes…' : 'Seleccioná un paciente'}
                    </option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Tratamiento
                  <input
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Fecha
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
              </div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                Descripción
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                Costo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                />
              </label>

              {formError && (
                <p className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{formError}</p>
              )}

              <div className="flex justify-end gap-3 text-xs">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/10 px-4 py-2 font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-cyan-500 px-5 py-2 font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : modalMode === 'edit' ? 'Guardar cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}