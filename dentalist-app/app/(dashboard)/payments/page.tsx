'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PaymentService } from '@/services/payment.service';
import { Payment, Patient } from '@/types';

interface PaymentWithPatient extends Payment {
  patient?: Patient;
}

const PAYMENT_METHOD_OPTIONS: Array<{ value: Payment['method']; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

type ModalMode = 'create' | 'edit';

const createEmptyForm = () => ({
  patientId: '',
  amount: '',
  method: 'cash' as Payment['method'],
  status: 'completed' as Payment['status'],
  date: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithPatient[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [form, setForm] = useState(() => createEmptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchPayments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/payments', { credentials: 'include' });
        if (!active) return;
        const data = (await response.json()) as PaymentWithPatient[];
        setPayments(data);
      } catch (error) {
        console.error('Error al cargar pagos', error);
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

    fetchPayments();
    fetchPatients();

    return () => {
      active = false;
    };
  }, []);

  const patientMap = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient] as [string, Patient])),
    [patients],
  );

  const filteredPayments = useMemo(() => {
    const list = status === 'all' ? payments : payments.filter((payment) => payment.status === status);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [payments, status]);

  const totals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, payment) => {
        if (payment.status === 'completed') acc.collected += payment.amount;
        if (payment.status === 'pending') acc.pending += payment.amount;
        return acc;
      },
      { collected: 0, pending: 0 },
    );
  }, [filteredPayments]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setForm((prev) => ({
      ...createEmptyForm(),
      patientId: prev.patientId || patients[0]?.id || '',
    }));
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (payment: PaymentWithPatient) => {
    setModalMode('edit');
    setEditingId(payment.id);
    setForm({
      patientId: payment.patientId,
      amount: payment.amount.toString(),
      method: payment.method,
      status: payment.status,
      date: payment.date.split('T')[0],
      notes: payment.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(createEmptyForm());
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const amount = Number(form.amount);
    if (!form.patientId || Number.isNaN(amount) || amount < 0) {
      setFormError('Indicá paciente y un monto válido.');
      return;
    }

    if (!form.date) {
      setFormError('Elegí una fecha para el pago.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (modalMode === 'edit' && editingId) {
        const response = await PaymentService.update({
          id: editingId,
          amount,
          method: form.method,
          status: form.status,
          date: form.date,
          notes: form.notes,
        });

        if (!response?.success || !response.payment) {
          throw new Error(response?.error ?? 'No pudimos actualizar el pago.');
        }

        const updatedPayment = response.payment;

        setPayments((prev) =>
          prev.map((item) =>
            item.id === updatedPayment.id
              ? {
                  ...updatedPayment,
                  patient: patientMap.get(updatedPayment.patientId) ?? item.patient,
                }
              : item,
          ),
        );
      } else {
        const response = await PaymentService.create({
          patientId: form.patientId,
          amount,
          method: form.method,
          status: form.status,
          date: form.date,
          notes: form.notes.trim() ? form.notes.trim() : undefined,
        });

        if (!response?.success || !response.payment) {
          throw new Error(response?.error ?? 'No pudimos registrar el pago.');
        }

        const withPatient: PaymentWithPatient = {
          ...response.payment,
          patient: patientMap.get(response.payment.patientId),
        };

        setPayments((prev) => [withPatient, ...prev]);
      }

      closeModal();
    } catch (error) {
      console.error('Error al guardar pago', error);
      setFormError(error instanceof Error ? error.message : 'No pudimos guardar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payment: PaymentWithPatient) => {
    if (deleteId || !window.confirm('¿Seguro que deseas eliminar este pago?')) {
      return;
    }

    try {
      setDeleteId(payment.id);
      const response = await PaymentService.remove(payment.id);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el pago.');
      }
      setPayments((prev) => prev.filter((item) => item.id !== payment.id));
      if (editingId === payment.id) {
        closeModal();
      }
    } catch (error) {
      console.error('Error al eliminar pago', error);
      alert(error instanceof Error ? error.message : 'No pudimos eliminar el pago.');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Pagos y cobranzas</h1>
          <p className="text-sm text-slate-300">Control de ingresos confirmados y saldos pendientes.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Registrar pago
          </button>
          <Link
            href="/treatments"
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Ver tratamientos
          </Link>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-200">
          {(['all', 'completed', 'pending'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full border px-4 py-2 capitalize transition ${
                status === value
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                  : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-emerald-300/60 hover:text-emerald-200'
              }`}
            >
              {value === 'all' ? 'Todos' : value === 'completed' ? 'Cobrados' : 'Pendientes'}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm text-emerald-50">
            <p>Cobrado</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-100">
              {totals.collected.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-50">
            <p>Pendiente</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">
              {totals.pending.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-300">Cargando pagos...</p>}

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Medio</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Notas</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="bg-slate-900/50">
                  <td className="px-6 py-4 text-slate-300">
                    {new Date(payment.date).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 text-slate-200">
                    {payment.patient?.name} {payment.patient?.lastName}
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-300">{payment.method}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        payment.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-amber-500/15 text-amber-200'
                      }`}
                    >
                      {payment.status === 'completed' ? 'Cobrado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{payment.notes ?? '—'}</td>
                  <td className="px-6 py-4 text-right text-emerald-300">
                    {payment.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEditModal(payment)}
                        className="rounded-full border border-white/15 px-3 py-1 font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(payment)}
                        disabled={deleteId === payment.id}
                        className="rounded-full border border-rose-400/40 px-3 py-1 font-semibold text-rose-200 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteId === payment.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-300">
                    No encontramos pagos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-sm text-slate-100 shadow-2xl shadow-cyan-500/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {modalMode === 'edit' ? 'Editar pago' : 'Registrar pago'}
                </h2>
                <p className="text-xs text-slate-400">
                  Guardamos el pago en el historial del paciente y en tus reportes.
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

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Fecha
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Monto
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Medio de pago
                  <select
                    value={form.method}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, method: event.target.value as Payment['method'] }))
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Estado
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value as Payment['status'] }))
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="completed">Cobrado</option>
                    <option value="pending">Pendiente</option>
                  </select>
                </label>
              </div>

              <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                Notas
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
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