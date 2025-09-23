'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { ClinicalHistoryForm } from '@/components/patients/ClinicalHistoryForm';
import { PrescriptionManager } from '@/components/patients/PrescriptionManager';
import { PatientService } from '@/services/patient.service';
import {
  Appointment,
  ClinicalHistory,
  ClinicalHistoryInput,
  CreatePrescriptionInput,
  Patient,
  Payment,
  Prescription,
  Treatment,
} from '@/types';

interface PatientDetailResponse {
  patient: Patient;
  appointments: Appointment[];
  treatments: Treatment[];
  payments: Payment[];
  clinicalHistory: ClinicalHistory | null;
  prescriptions: Prescription[];
}

export default function PatientDetailPage({ params: routeParams }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    address: '',
    healthInsurance: 'Particular',
    affiliateNumber: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [clinicalSaving, setClinicalSaving] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState<{ hasSignature: boolean; signatureUrl: string | null }>(
    {
      hasSignature: false,
      signatureUrl: null,
    },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await PatientService.getById(routeParams.id);
        if (response?.patient) {
          const normalized: PatientDetailResponse = {
            patient: response.patient,
            appointments: response.appointments ?? [],
            treatments: response.treatments ?? [],
            payments: response.payments ?? [],
            clinicalHistory: response.clinicalHistory ?? null,
            prescriptions: response.prescriptions ?? [],
          };
          setData(normalized);
        } else {
          throw new Error('Paciente no encontrado');
        }
        const signature = await PatientService.getProfessionalSignature();
        if (signature) {
          setSignatureInfo({
            hasSignature: Boolean(signature.hasSignature),
            signatureUrl: signature.signatureUrl ?? null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [routeParams.id]);

  const editParam = searchParams.get('edit');

  useEffect(() => {
    setIsEditing(editParam === 'true');
  }, [editParam]);

  useEffect(() => {
    if (isEditing && data?.patient) {
      setFormState({
        name: data.patient.name,
        lastName: data.patient.lastName,
        dni: data.patient.dni,
        email: data.patient.email,
        phone: data.patient.phone,
        address: data.patient.address,
        healthInsurance: data.patient.healthInsurance,
        affiliateNumber: data.patient.affiliateNumber ?? '',
        status: data.patient.status,
      });
      setFormError(null);
      setPageAlert(null);
    }
  }, [isEditing, data?.patient]);

  const handleFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const exitEditing = () => {
    setIsEditing(false);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('edit');
    const query = nextParams.toString();
    router.replace(`/patients/${routeParams.id}${query ? `?${query}` : ''}`, {
      scroll: false,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.patient) {
      return;
    }
    setSaving(true);
    setFormError(null);
    setPageAlert(null);

    try {
      const response = await PatientService.update(data.patient.id, formState);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos actualizar el paciente.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              patient: response.patient as Patient,
            }
          : current,
      );
      setPageAlert({ type: 'success', message: 'Datos del paciente actualizados correctamente.' });
      exitEditing();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocurrió un error inesperado al actualizar el paciente.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!data?.patient) {
      return;
    }
    const confirmed = window.confirm(
      '¿Deseás eliminar este paciente? Esta acción no se puede deshacer y se perderán los turnos asociados.',
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFormError(null);
    setPageAlert(null);

    try {
      const response = await PatientService.remove(data.patient.id);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el paciente.');
      }
      router.push('/patients');
    } catch (deleteError) {
      setPageAlert({
        type: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'Ocurrió un error inesperado al eliminar el paciente.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClinicalHistorySubmit = async (input: ClinicalHistoryInput) => {
    if (!data?.patient) {
      throw new Error('Paciente no disponible');
    }
    setClinicalSaving(true);
    try {
      const response = await PatientService.saveClinicalHistory(data.patient.id, input);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos guardar la historia clínica.');
      }
      setData((current) =>
        current
          ? {
              ...current,
              clinicalHistory: response.clinicalHistory ?? null,
            }
          : current,
      );
    } finally {
      setClinicalSaving(false);
    }
  };

  const handleCreatePrescription = async (input: CreatePrescriptionInput) => {
    if (!data?.patient) {
      return { success: false, error: 'Paciente no disponible' };
    }

    try {
      const response = await PatientService.createPrescription(data.patient.id, input);
      if (!response?.success || !response.prescription) {
        return {
          success: false,
          error: response?.error ?? 'No pudimos generar la receta',
        };
      }

      setData((current) =>
        current
          ? {
              ...current,
              prescriptions: [response.prescription as Prescription, ...current.prescriptions],
            }
          : current,
      );

      const signature = await PatientService.getProfessionalSignature();
      if (signature) {
        setSignatureInfo({
          hasSignature: Boolean(signature.hasSignature),
          signatureUrl: signature.signatureUrl ?? null,
        });
      }

      return { success: true, prescription: response.prescription as Prescription };
    } catch (creationError) {
      return {
        success: false,
        error:
          creationError instanceof Error
            ? creationError.message
            : 'No pudimos generar la receta',
      };
    }
  };

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

  const { patient, appointments, treatments, payments, clinicalHistory, prescriptions } = data;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            {patient.name} {patient.lastName}
          </h1>
          <p className="text-sm text-slate-300">
            DNI {patient.dni} • {patient.healthInsurance || 'Particular'}
            {patient.affiliateNumber ? ` • Afiliado ${patient.affiliateNumber}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/patients/${patient.id}?edit=true`}
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Editar datos
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-rose-400/60 px-5 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Eliminando...' : 'Eliminar paciente'}
          </button>
          <button
            onClick={() => setShowAppointmentForm((previous) => !previous)}
            className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            {showAppointmentForm ? 'Cerrar formulario' : 'Agendar turno'}
          </button>
          <Link
            href={`/calendar?patientId=${patient.id}`}
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Ver calendario
          </Link>
        </div>
      </div>

      {pageAlert && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            pageAlert.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {pageAlert.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          {isEditing && (
            <form
              onSubmit={handleSubmit}
              className="space-y-6 rounded-3xl border border-cyan-300/40 bg-slate-900/60 p-6 shadow-lg shadow-cyan-500/20"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Editar datos del paciente</h2>
                <button
                  type="button"
                  onClick={exitEditing}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                >
                  Cancelar edición
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Nombre
                  <input
                    required
                    name="name"
                    value={formState.name}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Apellido
                  <input
                    required
                    name="lastName"
                    value={formState.lastName}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  DNI
                  <input
                    required
                    name="dni"
                    value={formState.dni}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Email
                  <input
                    required
                    name="email"
                    type="email"
                    value={formState.email}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Teléfono
                  <input
                    name="phone"
                    value={formState.phone}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Dirección
                  <input
                    name="address"
                    value={formState.address}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Cobertura médica
                  <input
                    name="healthInsurance"
                    value={formState.healthInsurance}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  N.º de afiliado
                  <input
                    name="affiliateNumber"
                    value={formState.affiliateNumber}
                    onChange={handleFieldChange}
                    placeholder="Ej: 12345678/90"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Estado
                  <select
                    name="status"
                    value={formState.status}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </label>
              </div>

              {formError && (
                <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={exitEditing}
                  className="rounded-full border border-white/10 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-100/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}

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
                <dt className="text-slate-400">Cobertura médica</dt>
                <dd>
                  {patient.healthInsurance || 'Particular'}
                  {patient.affiliateNumber ? ` • Afiliado ${patient.affiliateNumber}` : ''}
                </dd>
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

          <ClinicalHistoryForm
            history={clinicalHistory}
            onSubmit={handleClinicalHistorySubmit}
            loading={clinicalSaving}
          />

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

          <PrescriptionManager
            prescriptions={prescriptions}
            onCreate={handleCreatePrescription}
            hasSavedSignature={signatureInfo.hasSignature}
            savedSignatureUrl={signatureInfo.signatureUrl}
          />
        </div>

        <aside className="space-y-6">
          {showAppointmentForm && (
            <div className="rounded-3xl border border-cyan-300/40 bg-slate-900/60 p-6 shadow-lg shadow-cyan-500/20">
              <h2 className="text-lg font-semibold text-white">Agendar nuevo turno</h2>
              <p className="mt-1 text-xs text-slate-300">
                El turno se sincroniza automáticamente con Google Calendar del profesional.
              </p>
              <div className="mt-4">
                <AppointmentForm
                  patients={[patient]}
                  defaultPatientId={patient.id}
                  onCreated={(appointment) => {
                    setData((currentData) =>
                      currentData
                        ? {
                            ...currentData,
                            appointments: [...currentData.appointments, { ...appointment, patient }],
                          }
                        : currentData,
                    );
                    setShowAppointmentForm(false);
                  }}
                />
              </div>
            </div>
          )}

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