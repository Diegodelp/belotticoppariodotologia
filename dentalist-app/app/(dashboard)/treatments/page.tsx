'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TreatmentService } from '@/services/treatment.service';
import { Treatment, Patient } from '@/types';

interface TreatmentWithPatient extends Treatment {
  patient?: Patient;
}

const createEmptyForm = () => ({
  patientId: '',
  type: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  cost: '',
});

type ModalMode = 'create' | 'edit';

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<TreatmentWithPatient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [form, setForm] = useState(() => createEmptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient] as [string, Patient])),
    [patients],
  );

  const filteredTreatments = useMemo(() => {
    const search = filter.trim().toLowerCase();
    if (!search) return treatments;
    return treatments.filter((treatment) =>
      `${treatment.type} ${treatment.description}`.toLowerCase().includes(search),
    );
  }, [filter, treatments]);

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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            placeholder="Buscar tratamiento o descripción"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 md:w-96"
          />
          <div className="rounded-full border border-white/10 bg-slate-900/60 px-5 py-2 text-xs text-slate-200">
            Facturación estimada: {totalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </div>
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando tratamientos...</p>}

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-[720px] divide-y divide-white/10 text-left text-sm text-slate-200">
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