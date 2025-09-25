'use client';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { ClinicalHistoryForm } from '@/components/patients/ClinicalHistoryForm';
import { PrescriptionManager } from '@/components/patients/PrescriptionManager';
import { PatientService } from '@/services/patient.service';
import { TreatmentService } from '@/services/treatment.service';
import { OrthodonticPlanService } from '@/services/orthodontic-plan.service';
import {
  Appointment,
  Budget,
  BudgetPractice,
  ClinicalHistory,
  ClinicalHistoryInput,
  CreateBudgetInput,
  CreatePrescriptionInput,
  OrthodonticPlan,
  Patient,
  PatientOrthodonticPlan,
  Payment,
  Prescription,
  Treatment,
} from '@/types';

const createEmptyTreatmentForm = () => ({
  type: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  cost: '',
});

const BUDGET_PRACTICES: Array<{ value: BudgetPractice; label: string }> = [
  { value: 'operatoria', label: 'Operatoria' },
  { value: 'exodoncia', label: 'Exodoncia' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'blanqueamiento', label: 'Blanqueamiento' },
  { value: 'implante', label: 'Implante' },
  { value: 'corona', label: 'Corona' },
  { value: 'carilla', label: 'Carilla' },
  { value: 'perno', label: 'Perno' },
  { value: 'endodoncia', label: 'Endodoncia' },
];

const createEmptyBudgetItem = () => ({
  practice: 'operatoria' as BudgetPractice,
  description: '',
  amount: '',
});

type BudgetFormItemState = ReturnType<typeof createEmptyBudgetItem>;

interface PatientDetailResponse {
  patient: Patient;
  appointments: Appointment[];
  treatments: Treatment[];
  payments: Payment[];
  clinicalHistory: ClinicalHistory | null;
  prescriptions: Prescription[];
  budgets: Budget[];
  orthodonticPlan: PatientOrthodonticPlan | null;
}

export default function PatientDetailPage({ params: routeParams }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
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
  const [treatmentForm, setTreatmentForm] = useState(() => createEmptyTreatmentForm());
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
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
  const [planOptions, setPlanOptions] = useState<OrthodonticPlan[]>([]);
  const [planOptionsLoading, setPlanOptionsLoading] = useState(true);
  const [planAlert, setPlanAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    title: '',
    notes: '',
    items: [createEmptyBudgetItem()],
  });
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetAlert, setBudgetAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [assignedPlan, setAssignedPlan] = useState<PatientOrthodonticPlan | null>(null);
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });

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
            budgets: response.budgets ?? [],
            orthodonticPlan: response.orthodonticPlan ?? null,
          };
          setData(normalized);
          setAssignedPlan(normalized.orthodonticPlan);
          setSelectedPlanId(normalized.orthodonticPlan?.planId ?? '');
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
    let active = true;

    const loadPlans = async () => {
      try {
        setPlanOptionsLoading(true);
        const response = await OrthodonticPlanService.list();
        if (!active) {
          return;
        }
        setPlanOptions(response.plans ?? []);
      } catch (error) {
        console.error('Error al cargar planes de ortodoncia', error);
        if (active) {
          setPlanAlert({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'No pudimos cargar los planes de ortodoncia disponibles.',
          });
        }
      } finally {
        if (active) {
          setPlanOptionsLoading(false);
        }
      }
    };

    loadPlans();

    return () => {
      active = false;
    };
  }, []);

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

  const handleTreatmentFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setTreatmentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleTreatmentCancel = () => {
    setShowTreatmentForm(false);
    setTreatmentForm(createEmptyTreatmentForm());
    setTreatmentError(null);
  };

  const handlePlanSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlanId(event.target.value);
  };

  const handleAssignPlan = async () => {
    if (!data?.patient) {
      return;
    }
    if (!selectedPlanId) {
      setPlanAlert({ type: 'error', message: 'Seleccioná un plan de ortodoncia para asignar.' });
      return;
    }

    try {
      setAssigningPlan(true);
      setPlanAlert(null);
      const response = await PatientService.assignOrthodonticPlan(data.patient.id, selectedPlanId);
      if (!response || !response.success || !response.plan) {
        throw new Error((response as { error?: string })?.error ?? 'No pudimos asignar el plan.');
      }
      setAssignedPlan(response.plan);
      setSelectedPlanId(response.plan.planId);
      setPlanAlert({ type: 'success', message: 'Plan asignado correctamente.' });
      setData((current) =>
        current
          ? {
              ...current,
              orthodonticPlan: response.plan,
            }
          : current,
      );
    } catch (error) {
      setPlanAlert({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No pudimos asignar el plan de ortodoncia. Intentá nuevamente.',
      });
    } finally {
      setAssigningPlan(false);
    }
  };

  const handleRemovePlan = async () => {
    if (!data?.patient || !assignedPlan) {
      return;
    }

    try {
      setAssigningPlan(true);
      setPlanAlert(null);
      const response = await PatientService.removeOrthodonticPlan(data.patient.id);
      if (!response || !response.success) {
        throw new Error((response as { error?: string })?.error ?? 'No pudimos quitar el plan.');
      }
      setAssignedPlan(null);
      setSelectedPlanId('');
      setPlanAlert({ type: 'success', message: 'El plan se eliminó del paciente.' });
      setData((current) =>
        current
          ? {
              ...current,
              orthodonticPlan: null,
            }
          : current,
      );
    } catch (error) {
      setPlanAlert({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No pudimos quitar el plan de ortodoncia. Intentá nuevamente.',
      });
    } finally {
      setAssigningPlan(false);
    }
  };

  const handleBudgetFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setBudgetForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleBudgetItemChange = (
    index: number,
    field: keyof BudgetFormItemState,
    value: string,
  ) => {
    setBudgetForm((previous) => {
      const nextItems = previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      );
      return { ...previous, items: nextItems };
    });
  };

  const addBudgetItem = () => {
    setBudgetForm((previous) => ({
      ...previous,
      items: [...previous.items, createEmptyBudgetItem()],
    }));
  };

  const removeBudgetItem = (index: number) => {
    setBudgetForm((previous) => {
      if (previous.items.length <= 1) {
        return previous;
      }
      const nextItems = previous.items.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...previous,
        items: nextItems.length > 0 ? nextItems : [createEmptyBudgetItem()],
      };
    });
  };

  const handleBudgetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.patient) {
      return;
    }

    const title = budgetForm.title.trim();
    const notes = budgetForm.notes?.trim();

    if (!title) {
      setBudgetAlert({ type: 'error', message: 'Ingresá un título para el presupuesto.' });
      return;
    }

    const items = budgetForm.items
      .map((item) => {
        const amount = Number(item.amount);
        if (Number.isNaN(amount) || amount < 0) {
          return null;
        }
        const description = item.description?.trim();
        const sanitized: CreateBudgetInput['items'][number] = description
          ? {
              practice: item.practice,
              description,
              amount,
            }
          : {
              practice: item.practice,
              amount,
            };
        return sanitized;
      })
      .filter((item): item is CreateBudgetInput['items'][number] => item !== null);

    if (items.length === 0) {
      setBudgetAlert({
        type: 'error',
        message: 'Añadí al menos una práctica con un importe válido para el presupuesto.',
      });
      return;
    }

    const payload: CreateBudgetInput = {
      title,
      notes,
      items,
    };

    try {
      setBudgetSaving(true);
      setBudgetAlert(null);
      const response = await PatientService.createBudget(data.patient.id, payload);
      if (!response || !response.success || !response.budget) {
        throw new Error((response as { error?: string })?.error ?? 'No pudimos crear el presupuesto.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              budgets: [response.budget, ...(current.budgets ?? [])],
            }
          : current,
      );
      setBudgetForm({ title: '', notes: '', items: [createEmptyBudgetItem()] });
      setBudgetAlert({ type: 'success', message: 'Presupuesto creado correctamente.' });
    } catch (error) {
      setBudgetAlert({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No pudimos crear el presupuesto. Intentá nuevamente.',
      });
    } finally {
      setBudgetSaving(false);
    }
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

  const handleDeletePrescription = async (prescriptionId: string) => {
    if (!data?.patient) {
      return { success: false, error: 'Paciente no disponible' };
    }

    try {
      const response = await PatientService.deletePrescription(data.patient.id, prescriptionId);
      if (!response?.success) {
        return {
          success: false,
          error: response?.error ?? 'No pudimos eliminar la receta',
        };
      }

      setData((current) =>
        current
          ? {
              ...current,
              prescriptions: current.prescriptions.filter((item) => item.id !== prescriptionId),
            }
          : current,
      );

      return { success: true };
    } catch (deleteError) {
      return {
        success: false,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : 'No pudimos eliminar la receta',
      };
    }
  };

  const handleUpdateSignature = async (signatureDataUrl: string) => {
    try {
      const response = await PatientService.updateProfessionalSignature(signatureDataUrl);
      if (!response?.success) {
        return {
          success: false,
          error: response?.error ?? 'No pudimos actualizar la firma digital',
        };
      }

      setSignatureInfo({
        hasSignature: Boolean(response.hasSignature ?? true),
        signatureUrl: response.signatureUrl ?? null,
      });

      return { success: true, signatureUrl: response.signatureUrl ?? null };
    } catch (updateError) {
      return {
        success: false,
        error:
          updateError instanceof Error
            ? updateError.message
            : 'No pudimos actualizar la firma digital',
      };
    }
  };

  const handleTreatmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data?.patient) {
      return;
    }

    const trimmedType = treatmentForm.type.trim();
    const trimmedDescription = treatmentForm.description.trim();
    const costValue = Number(treatmentForm.cost);

    if (!trimmedType || !trimmedDescription || !treatmentForm.date || Number.isNaN(costValue)) {
      setTreatmentError('Completá todos los campos del tratamiento con valores válidos.');
      return;
    }

    setTreatmentSaving(true);
    setTreatmentError(null);
    setPageAlert(null);

    try {
      const response = await TreatmentService.create({
        patientId: data.patient.id,
        type: trimmedType,
        description: trimmedDescription,
        date: treatmentForm.date,
        cost: costValue,
      });

      if (!response?.success || !response.treatment) {
        throw new Error(response?.error ?? 'No pudimos registrar el tratamiento.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              treatments: [response.treatment as Treatment, ...current.treatments],
            }
          : current,
      );

      setPageAlert({
        type: 'success',
        message: 'Tratamiento registrado correctamente.',
      });

      setTreatmentForm(createEmptyTreatmentForm());
      setShowTreatmentForm(false);
    } catch (submitError) {
      setTreatmentError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocurrió un error al guardar el tratamiento.',
      );
    } finally {
      setTreatmentSaving(false);
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

  const { patient, appointments, treatments, payments, clinicalHistory, prescriptions, budgets } = data;

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Plan de ortodoncia</h2>
              <Link href="/settings" className="text-xs text-cyan-200 hover:underline">
                Gestionar planes
              </Link>
            </div>

            {planAlert && (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
                  planAlert.type === 'success'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                }`}
              >
                {planAlert.message}
              </p>
            )}

            <div className="mt-4 space-y-4 text-sm text-slate-200">
              {planOptionsLoading ? (
                <p className="text-slate-400">Cargando planes disponibles…</p>
              ) : assignedPlan ? (
                <div className="rounded-2xl bg-slate-900/60 p-4">
                  <p className="text-base font-semibold text-white">{assignedPlan.name}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Cuota mensual</dt>
                      <dd>{currencyFormatter.format(assignedPlan.monthlyFee)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Entrega inicial</dt>
                      <dd>
                        {assignedPlan.hasInitialFee
                          ? currencyFormatter.format(assignedPlan.initialFee ?? 0)
                          : 'No requiere entrega'}
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-slate-400">Asignado el</dt>
                      <dd>{new Date(assignedPlan.assignedAt).toLocaleDateString('es-AR')}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={handleRemovePlan}
                    disabled={assigningPlan}
                    className="mt-4 rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningPlan ? 'Quitando plan…' : 'Quitar plan del paciente'}
                  </button>
                </div>
              ) : planOptions.length === 0 ? (
                <p className="text-slate-400">
                  Todavía no creaste planes de ortodoncia. Podés configurarlos desde la sección de ajustes.
                </p>
              ) : (
                <div className="rounded-2xl bg-slate-900/60 p-4">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Seleccioná un plan
                    <select
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                      value={selectedPlanId}
                      onChange={handlePlanSelectionChange}
                    >
                      <option value="">Elegí un plan…</option>
                      {planOptions.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — {currencyFormatter.format(plan.monthlyFee)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleAssignPlan}
                    disabled={assigningPlan || !selectedPlanId}
                    className="mt-4 w-full rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningPlan ? 'Asignando…' : 'Asignar plan'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <h2 className="text-lg font-semibold text-white">Presupuestos</h2>

            {budgetAlert && (
              <p
                className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
                  budgetAlert.type === 'success'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                }`}
              >
                {budgetAlert.message}
              </p>
            )}

            <form
              onSubmit={handleBudgetSubmit}
              className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2 text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Título del presupuesto
                  <input
                    name="title"
                    value={budgetForm.title}
                    onChange={handleBudgetFieldChange}
                    placeholder="Ej: Tratamiento integral"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="md:col-span-2 text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Notas para el paciente
                  <textarea
                    name="notes"
                    value={budgetForm.notes}
                    onChange={handleBudgetFieldChange}
                    rows={3}
                    placeholder="Detalles adicionales o condiciones"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
              </div>

              <div className="space-y-4">
                {budgetForm.items.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 md:grid-cols-4">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-300 md:col-span-1">
                      Práctica
                      <select
                        value={item.practice}
                        onChange={(event) => handleBudgetItemChange(index, 'practice', event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                      >
                        {BUDGET_PRACTICES.map((practice) => (
                          <option key={practice.value} value={practice.value}>
                            {practice.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-300 md:col-span-2">
                      Descripción
                      <input
                        value={item.description}
                        onChange={(event) => handleBudgetItemChange(index, 'description', event.target.value)}
                        placeholder="Detalles de la práctica"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-300 md:col-span-1">
                      Importe
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) => handleBudgetItemChange(index, 'amount', event.target.value)}
                        placeholder="Ej: 60000"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                      />
                    </label>
                    <div className="md:col-span-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeBudgetItem(index)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-rose-300 hover:text-rose-200"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBudgetItem}
                  className="w-full rounded-full border border-cyan-400/60 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10"
                >
                  Añadir práctica
                </button>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={budgetSaving}
                  className="rounded-full bg-cyan-500 px-6 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {budgetSaving ? 'Generando…' : 'Generar presupuesto'}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3 text-sm text-slate-200">
              {budgets.length === 0 ? (
                <p className="text-slate-400">Todavía no se generaron presupuestos para este paciente.</p>
              ) : (
                budgets.map((budget) => (
                  <div key={budget.id} className="rounded-2xl bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{budget.title}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(budget.createdAt).toLocaleDateString('es-AR')} • Total {currencyFormatter.format(budget.total)}
                        </p>
                        {budget.notes && <p className="mt-2 text-xs text-slate-300">{budget.notes}</p>}
                      </div>
                      {budget.documentUrl && (
                        <a
                          href={budget.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-cyan-400/60 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10"
                        >
                          Descargar PDF
                        </a>
                      )}
                    </div>
                    {budget.items.length > 0 && (
                      <ul className="mt-3 space-y-2 text-xs text-slate-300">
                        {budget.items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2">
                            <div>
                              <p className="font-semibold text-white">{BUDGET_PRACTICES.find((practice) => practice.value === item.practice)?.label ?? item.practice}</p>
                              {item.description && <p className="text-[11px] text-slate-400">{item.description}</p>}
                            </div>
                            <span className="text-emerald-300">{currencyFormatter.format(item.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Historial de tratamientos</h2>
              <div className="flex items-center gap-3">
                <Link href={`/treatments?patientId=${patient.id}`} className="text-xs text-cyan-200 hover:underline">
                  Ver todo
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (showTreatmentForm) {
                      setTreatmentForm(createEmptyTreatmentForm());
                      setTreatmentError(null);
                    }
                    setShowTreatmentForm((current) => !current);
                  }}
                  className="rounded-full border border-cyan-400/60 px-4 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10"
                >
                  {showTreatmentForm ? 'Cerrar formulario' : 'Registrar tratamiento'}
                </button>
              </div>
            </div>

            {showTreatmentForm && (
              <form
                onSubmit={handleTreatmentSubmit}
                className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Tipo de tratamiento
                    <input
                      name="type"
                      value={treatmentForm.type}
                      onChange={handleTreatmentFieldChange}
                      placeholder="Ej: Ortodoncia"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Fecha
                    <input
                      type="date"
                      name="date"
                      value={treatmentForm.date}
                      onChange={handleTreatmentFieldChange}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Descripción
                    <textarea
                      name="description"
                      value={treatmentForm.description}
                      onChange={handleTreatmentFieldChange}
                      rows={3}
                      placeholder="Detalles del procedimiento realizado"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Monto
                    <input
                      type="number"
                      name="cost"
                      min="0"
                      step="0.01"
                      value={treatmentForm.cost}
                      onChange={handleTreatmentFieldChange}
                      placeholder="Ej: 55000"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    />
                  </label>
                </div>

                {treatmentError && (
                  <p className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{treatmentError}</p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleTreatmentCancel}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-100/60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={treatmentSaving}
                    className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {treatmentSaving ? 'Guardando...' : 'Guardar tratamiento'}
                  </button>
                </div>
              </form>
            )}

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
            onDelete={handleDeletePrescription}
            onUpdateSignature={handleUpdateSignature}
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