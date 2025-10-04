'use client';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { ClinicalHistoryForm } from '@/components/patients/ClinicalHistoryForm';
import { PatientMediaManager } from '@/components/patients/PatientMediaManager';
import { PrescriptionManager } from '@/components/patients/PrescriptionManager';
import { SignaturePad } from '@/components/patients/SignaturePad';
import { PatientService } from '@/services/patient.service';
import { PaymentService } from '@/services/payment.service';
import { TreatmentService } from '@/services/treatment.service';
import { OrthodonticPlanService } from '@/services/orthodontic-plan.service';
import { TeamService } from '@/services/team.service';
import { useAuth } from '@/hooks/useAuth';
import { isProPlan } from '@/lib/utils/subscription';
import {
  Appointment,
  Budget,
  BudgetPractice,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalMedia,
  CreateBudgetInput,
  CreatePrescriptionInput,
  Clinic,
  OrthodonticPlan,
  Patient,
  PatientOrthodonticPlan,
  Payment,
  Prescription,
  Treatment,
  UpdateOrthodonticPlanDetailsInput,
} from '@/types';

const createEmptyTreatmentForm = () => ({
  type: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  cost: '',
  consentPatientName: '',
  consentFile: null as File | null,
  consentFileName: '',
  consentSignatureDataUrl: null as string | null,
  consentFileChanged: false,
  consentSignatureEdited: false,
});

type TreatmentFormState = ReturnType<typeof createEmptyTreatmentForm>;

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
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'regeneracionTisular', label: 'Regeneración tisular' },
  { value: 'otro', label: 'Otro' },
];

const TREATMENT_TYPE_OPTIONS = [
  'Operatoria',
  'Exodoncia',
  'Limpieza',
  'Blanqueamiento',
  'Implante',
  'Corona',
  'Carilla',
  'Perno',
  'Endodoncia',
  'Urgencia',
  'Regeneración tisular',
  'Otro',
].map((label) => ({ value: label, label }));

const PAYMENT_METHOD_LABELS: Record<Payment['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const createEmptyBudgetItem = () => ({
  practice: 'operatoria' as BudgetPractice,
  description: '',
  amount: '',
});

type BudgetFormItemState = ReturnType<typeof createEmptyBudgetItem>;

const createPlanDetailsState = (plan: PatientOrthodonticPlan | null) => ({
  treatmentGoal: plan?.treatmentGoal ?? '',
  appliance: plan?.appliance ?? '',
  controlFrequency: plan?.controlFrequency ?? '',
  estimatedDuration: plan?.estimatedDuration ?? '',
  planNotes: plan?.planNotes ?? '',
});

type PatientSectionKey = 'overview' | 'clinicalHistory' | 'orthodonticPlan' | 'media';

const PATIENT_SECTION_OPTIONS: Array<{
  key: PatientSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'overview',
    label: 'Principal',
    description: 'Detalles, turnos y documentos',
  },
  {
    key: 'clinicalHistory',
    label: 'Historia clínica',
    description: 'Odontograma y antecedentes',
  },
  {
    key: 'orthodonticPlan',
    label: 'Plan de tratamiento ortodóncico',
    description: 'Definición del plan y evolución cefalométrica',
  },
  {
    key: 'media',
    label: 'Fotos y RX',
    description: 'Registros fotográficos y radiografías',
  },
];

interface PatientDetailResponse {
  patient: Patient;
  appointments: Appointment[];
  treatments: Treatment[];
  payments: Payment[];
  clinicalHistory: ClinicalHistory | null;
  prescriptions: Prescription[];
  budgets: Budget[];
  orthodonticPlan: PatientOrthodonticPlan | null;
  media: ClinicalMedia[];
}

export default function PatientDetailPage({ params: routeParams }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
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
  const [treatmentForm, setTreatmentForm] = useState<TreatmentFormState>(() => createEmptyTreatmentForm());
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [treatmentDeletingId, setTreatmentDeletingId] = useState<string | null>(null);
  const [editingTreatmentConsent, setEditingTreatmentConsent] = useState<Treatment['consent'] | null>(null);
  const treatmentTypeIsCustom = useMemo(
    () =>
      Boolean(
        treatmentForm.type &&
          !TREATMENT_TYPE_OPTIONS.some((option) => option.value === treatmentForm.type),
      ),
    [treatmentForm.type],
  );
  const [signatureInfo, setSignatureInfo] = useState<{ hasSignature: boolean; signatureUrl: string | null }>(
    {
      hasSignature: false,
      signatureUrl: null,
    },
  );
  const [prescriptionAlert, setPrescriptionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [prescriptionModalTab, setPrescriptionModalTab] = useState<'history' | 'create'>('history');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageAlert, setPageAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [planOptions, setPlanOptions] = useState<OrthodonticPlan[]>([]);
  const [planOptionsLoading, setPlanOptionsLoading] = useState(true);
  const [planAlert, setPlanAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [planDetails, setPlanDetails] = useState(() => createPlanDetailsState(null));
  const [planDetailsSaving, setPlanDetailsSaving] = useState(false);
  const [planDetailsAlert, setPlanDetailsAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    title: '',
    notes: '',
    items: [createEmptyBudgetItem()],
  });
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetAlert, setBudgetAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetDeletingId, setBudgetDeletingId] = useState<string | null>(null);
  const [budgetSendingId, setBudgetSendingId] = useState<string | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetPaymentContext, setBudgetPaymentContext] = useState<{
    budgetId: string;
    itemId: string;
  } | null>(null);
  const [budgetPaymentMethod, setBudgetPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [budgetPaymentSaving, setBudgetPaymentSaving] = useState(false);
  const [budgetPaymentError, setBudgetPaymentError] = useState<string | null>(null);
  const [budgetPaymentConsentName, setBudgetPaymentConsentName] = useState('');
  const [budgetPaymentConsentFile, setBudgetPaymentConsentFile] = useState<File | null>(null);
  const [budgetPaymentConsentFileName, setBudgetPaymentConsentFileName] = useState('');
  const [budgetPaymentConsentSignature, setBudgetPaymentConsentSignature] = useState<string | null>(null);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [clinicOptions, setClinicOptions] = useState<Clinic[]>([]);
  const [clinicOptionsLoading, setClinicOptionsLoading] = useState(false);
  const [clinicOptionsError, setClinicOptionsError] = useState<string | null>(null);
  const [clinicSelection, setClinicSelection] = useState('');
  const [assignedPlan, setAssignedPlan] = useState<PatientOrthodonticPlan | null>(null);
  const [activeSection, setActiveSection] = useState<PatientSectionKey>('overview');
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
  const isEditingBudget = Boolean(editingBudgetId);
  const budgetSubmitLabel = budgetSaving
    ? isEditingBudget
      ? 'Guardando…'
      : 'Generando…'
    : isEditingBudget
      ? 'Guardar cambios'
      : 'Generar presupuesto';
  const patientHasEmail = Boolean(data?.patient?.email && data.patient.email.trim().length > 0);

  const sortedPrescriptions = useMemo(() => {
    const list = data?.prescriptions ?? [];
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [data?.prescriptions]);

  const sectionOptions = useMemo(
    () =>
      PATIENT_SECTION_OPTIONS.filter(
        (option) => option.key !== 'orthodonticPlan' || Boolean(assignedPlan),
      ),
    [assignedPlan],
  );

  const budgetPaymentTarget = useMemo(() => {
    if (!budgetPaymentContext || !data?.budgets) {
      return null;
    }

    const budget = data.budgets.find((item) => item.id === budgetPaymentContext.budgetId);
    if (!budget) {
      return null;
    }

    const item = budget.items.find((budgetItem) => budgetItem.id === budgetPaymentContext.itemId);
    if (!item) {
      return null;
    }

    return { budget, item } as const;
  }, [budgetPaymentContext, data?.budgets]);

  const budgetPaymentPracticeLabel = budgetPaymentTarget
    ? BUDGET_PRACTICES.find((practice) => practice.value === budgetPaymentTarget.item.practice)?.label ??
      budgetPaymentTarget.item.practice
    : '';

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
            media: response.media ?? [],
          };
          setData(normalized);
          setAssignedPlan(normalized.orthodonticPlan);
          setSelectedPlanId(normalized.orthodonticPlan?.planId ?? '');
          setPlanDetails(createPlanDetailsState(normalized.orthodonticPlan));
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

  useEffect(() => {
    if (data?.patient) {
      setClinicSelection(data.patient.clinicId ?? '');
    }
  }, [data?.patient]);

  useEffect(() => {
    if (activeSection === 'orthodonticPlan' && !assignedPlan) {
      setActiveSection('overview');
    }
  }, [activeSection, assignedPlan]);

  useEffect(() => {
    setPlanDetails(createPlanDetailsState(assignedPlan));
  }, [assignedPlan]);

  const editParam = searchParams.get('edit');

  useEffect(() => {
    setIsEditing(editParam === 'true');
  }, [editParam]);

  useEffect(() => {
    if (budgetPaymentContext) {
      setBudgetPaymentMethod('cash');
      setBudgetPaymentError(null);
      const defaultConsentName = data?.patient
        ? `${data.patient.name ?? ''} ${data.patient.lastName ?? ''}`.trim()
        : '';
      setBudgetPaymentConsentName(defaultConsentName);
      setBudgetPaymentConsentFile(null);
      setBudgetPaymentConsentFileName('');
      setBudgetPaymentConsentSignature(null);
    }
  }, [budgetPaymentContext, data?.patient]);

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

  const isProfessional = user?.type === 'profesional';
  const isTeamMember = Boolean(user?.ownerProfessionalId);
  const isTeamAdmin = isTeamMember && user?.teamRole === 'admin';
  const isOwnerProfessional = isProfessional && !isTeamMember;
  const hasProPlan = isProPlan(user?.subscriptionPlan ?? null);
  const canEditClinicAssignment = Boolean(isProfessional && hasProPlan && (isOwnerProfessional || isTeamAdmin));

  useEffect(() => {
    if (!canEditClinicAssignment || !isEditing) {
      setClinicOptions([]);
      setClinicOptionsError(null);
      setClinicOptionsLoading(false);
      return;
    }

    let active = true;

    const loadClinics = async () => {
      try {
        setClinicOptionsLoading(true);
        setClinicOptionsError(null);
        const overview = await TeamService.getOverview();
        if (!active) {
          return;
        }
        setClinicOptions(overview.clinics);
      } catch (fetchError) {
        console.error('Error al cargar consultorios', fetchError);
        if (active) {
          setClinicOptions([]);
          setClinicOptionsError('No pudimos cargar los consultorios disponibles.');
        }
      } finally {
        if (active) {
          setClinicOptionsLoading(false);
        }
      }
    };

    loadClinics();

    return () => {
      active = false;
    };
  }, [canEditClinicAssignment, isEditing]);

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
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setTreatmentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleTreatmentConsentFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setTreatmentForm((previous) => ({
      ...previous,
      consentFile: file,
      consentFileName: file?.name ?? '',
      consentFileChanged: Boolean(file),
    }));
    event.target.value = '';
  };

  const handleTreatmentSignatureChange = (dataUrl: string | null) => {
    setTreatmentForm((previous) => ({
      ...previous,
      consentSignatureDataUrl: dataUrl,
      consentSignatureEdited: dataUrl !== null,
    }));
  };

  const handleBudgetPaymentConsentFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setBudgetPaymentConsentFile(file);
    setBudgetPaymentConsentFileName(file?.name ?? '');
    event.target.value = '';
  };

  const handleBudgetPaymentSignatureChange = (dataUrl: string | null) => {
    setBudgetPaymentConsentSignature(dataUrl);
  };

  const handleTreatmentCancel = () => {
    setShowTreatmentForm(false);
    setTreatmentForm(createEmptyTreatmentForm());
    setTreatmentError(null);
    setEditingTreatmentId(null);
    setEditingTreatmentConsent(null);
  };

  const handlePlanSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlanId(event.target.value);
  };

  const handleClinicSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setClinicSelection(event.target.value);
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
      setPlanDetails(createPlanDetailsState(response.plan));
      setPlanDetailsAlert(null);
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
      setPlanDetails(createPlanDetailsState(null));
      setPlanDetailsAlert(null);
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

  const handlePlanDetailsChange = (
    field: keyof ReturnType<typeof createPlanDetailsState>,
    value: string,
  ) => {
    setPlanDetails((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handlePlanDetailsReset = () => {
    setPlanDetails(createPlanDetailsState(assignedPlan));
    setPlanDetailsAlert(null);
  };

  const handlePlanDetailsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.patient || !assignedPlan) {
      return;
    }

    const payload: UpdateOrthodonticPlanDetailsInput = {
      treatmentGoal: planDetails.treatmentGoal.trim() ? planDetails.treatmentGoal.trim() : null,
      appliance: planDetails.appliance.trim() ? planDetails.appliance.trim() : null,
      controlFrequency: planDetails.controlFrequency.trim() ? planDetails.controlFrequency.trim() : null,
      estimatedDuration: planDetails.estimatedDuration.trim() ? planDetails.estimatedDuration.trim() : null,
      planNotes: planDetails.planNotes.trim() ? planDetails.planNotes.trim() : null,
    };

    setPlanDetailsSaving(true);
    setPlanDetailsAlert(null);

    try {
      const response = await PatientService.updateOrthodonticPlanDetails(data.patient.id, payload);
      if (!response?.success || !response.plan) {
        throw new Error((response as { error?: string })?.error ?? 'No pudimos actualizar el plan.');
      }

      setAssignedPlan(response.plan);
      setPlanDetails(createPlanDetailsState(response.plan));
      setPlanDetailsAlert({ type: 'success', message: 'Actualizaste el plan de tratamiento.' });
      setData((current) =>
        current
          ? {
              ...current,
              orthodonticPlan: response.plan,
            }
          : current,
      );
    } catch (error) {
      setPlanDetailsAlert({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No pudimos actualizar los detalles del plan. Intentá nuevamente.',
      });
    } finally {
      setPlanDetailsSaving(false);
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

  const resetBudgetForm = () => {
    setBudgetForm({ title: '', notes: '', items: [createEmptyBudgetItem()] });
  };

  const openBudgetModalForNew = () => {
    setBudgetAlert(null);
    setEditingBudgetId(null);
    resetBudgetForm();
    setIsBudgetModalOpen(true);
  };

  const closeBudgetModal = (preserveAlert = false) => {
    if (!preserveAlert) {
      setBudgetAlert(null);
    }
    setIsBudgetModalOpen(false);
    setEditingBudgetId(null);
    resetBudgetForm();
  };

  const openBudgetPaymentModal = (budgetId: string, itemId: string) => {
    setBudgetPaymentContext({ budgetId, itemId });
  };

  const closeBudgetPaymentModal = () => {
    setBudgetPaymentContext(null);
    setBudgetPaymentError(null);
    setBudgetPaymentSaving(false);
    setBudgetPaymentConsentName('');
    setBudgetPaymentConsentFile(null);
    setBudgetPaymentConsentFileName('');
    setBudgetPaymentConsentSignature(null);
  };

  const handleBudgetEdit = (budget: Budget) => {
    setBudgetAlert(null);
    setEditingBudgetId(budget.id);
    setBudgetForm({
      title: budget.title,
      notes: budget.notes ?? '',
      items:
        budget.items.length > 0
          ? budget.items.map((item) => ({
              practice: item.practice,
              description: item.description ?? '',
              amount: item.amount.toString(),
            }))
          : [createEmptyBudgetItem()],
    });
    setIsBudgetModalOpen(true);
  };

  const handleCancelBudgetEdit = () => {
    setEditingBudgetId(null);
    resetBudgetForm();
  };

  const openPrescriptionModal = () => {
    setPrescriptionAlert(null);
    setPrescriptionModalTab('history');
    setIsPrescriptionModalOpen(true);
  };

  const closePrescriptionModal = () => {
    setIsPrescriptionModalOpen(false);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!data?.patient) {
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('¿Seguro que querés eliminar este presupuesto?');
      if (!confirmed) {
        return;
      }
    }

    try {
      setBudgetAlert(null);
      setBudgetDeletingId(budgetId);
      const response = await PatientService.deleteBudget(data.patient.id, budgetId);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el presupuesto.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              budgets: current.budgets.filter((budget) => budget.id !== budgetId),
            }
          : current,
      );

      if (editingBudgetId === budgetId) {
        handleCancelBudgetEdit();
      }

      setBudgetAlert({ type: 'success', message: 'Presupuesto eliminado correctamente.' });
    } catch (deleteError) {
      setBudgetAlert({
        type: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'No pudimos eliminar el presupuesto. Intentá nuevamente.',
      });
    } finally {
      setBudgetDeletingId(null);
    }
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

    const currentEditingId = editingBudgetId;

    try {
      setBudgetSaving(true);
      setBudgetAlert(null);

      const response = currentEditingId
        ? await PatientService.updateBudget(data.patient.id, currentEditingId, payload)
        : await PatientService.createBudget(data.patient.id, payload);

      if (!response || !response.success || !response.budget) {
        throw new Error((response as { error?: string })?.error ?? 'No pudimos guardar el presupuesto.');
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        if (currentEditingId) {
          return {
            ...current,
            budgets: current.budgets.map((budget) =>
              budget.id === response.budget.id ? response.budget : budget,
            ),
          };
        }

        return {
          ...current,
          budgets: [response.budget, ...(current.budgets ?? [])],
        };
      });

      setBudgetAlert({
        type: 'success',
        message: currentEditingId
          ? 'Presupuesto actualizado correctamente.'
          : 'Presupuesto creado correctamente.',
      });
      closeBudgetModal(true);
    } catch (error) {
      setBudgetAlert({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No pudimos guardar el presupuesto. Intentá nuevamente.',
      });
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleSendBudget = async (budget: Budget) => {
    if (!data?.patient) {
      return;
    }

    if (!patientHasEmail) {
      setBudgetAlert({
        type: 'error',
        message: 'El paciente no tiene un correo electrónico registrado.',
      });
      return;
    }

    try {
      setBudgetSendingId(budget.id);
      setBudgetAlert(null);
      const response = await PatientService.sendBudget(data.patient.id, budget.id);
      if (response.success) {
        setBudgetAlert({ type: 'success', message: 'Presupuesto enviado por correo.' });
      } else {
        setBudgetAlert({
          type: 'error',
          message: response.error ?? 'No pudimos enviar el presupuesto. Intentá nuevamente.',
        });
      }
    } catch (error) {
      console.error('Error al enviar presupuesto', error);
      setBudgetAlert({
        type: 'error',
        message: 'No pudimos enviar el presupuesto. Intentá nuevamente.',
      });
    } finally {
      setBudgetSendingId(null);
    }
  };

  const handleBudgetItemPayment = async () => {
    if (!data?.patient || !budgetPaymentTarget) {
      return;
    }

    const now = new Date();
    const descriptionFallback = budgetPaymentPracticeLabel
      ? `Tratamiento correspondiente a ${budgetPaymentPracticeLabel.toLowerCase()}`
      : 'Tratamiento correspondiente al presupuesto';
    const paymentNotes = budgetPaymentPracticeLabel
      ? `Pago de ${budgetPaymentPracticeLabel} (${budgetPaymentTarget.budget.title})`
      : `Pago del presupuesto ${budgetPaymentTarget.budget.title}`;

    try {
      setBudgetPaymentError(null);
      const itemDescription = budgetPaymentTarget.item.description?.trim() ?? '';

      const resolvedConsentName = budgetPaymentConsentName.trim().length
        ? budgetPaymentConsentName.trim()
        : `${data.patient.name ?? ''} ${data.patient.lastName ?? ''}`.trim();

      if (!resolvedConsentName) {
        setBudgetPaymentError('Indicá el nombre y la aclaración del paciente para el consentimiento.');
        return;
      }

      if (!budgetPaymentConsentFile) {
        setBudgetPaymentError('Adjuntá el consentimiento informado en formato PDF.');
        return;
      }

      if (!budgetPaymentConsentSignature) {
        setBudgetPaymentError('Registrá la firma digital del paciente para el consentimiento informado.');
        return;
      }

      setBudgetPaymentSaving(true);

      const [paymentResponse, treatmentResponse] = await Promise.all([
        PaymentService.create({
          patientId: data.patient.id,
          amount: budgetPaymentTarget.item.amount,
          method: budgetPaymentMethod,
          status: 'completed',
          date: now.toISOString(),
          notes: paymentNotes,
        }),
        TreatmentService.create({
          patientId: data.patient.id,
          type: budgetPaymentPracticeLabel || 'Tratamiento',
          description: itemDescription.length > 0 ? itemDescription : descriptionFallback,
          cost: budgetPaymentTarget.item.amount,
          date: now.toISOString(),
          consent: {
            patientName: resolvedConsentName,
            file: budgetPaymentConsentFile,
            signatureDataUrl: budgetPaymentConsentSignature,
          },
        }),
      ]);

      if (!paymentResponse?.success || !paymentResponse.payment) {
        throw new Error(paymentResponse?.error ?? 'No pudimos registrar el pago.');
      }

      if (!treatmentResponse?.success || !treatmentResponse.treatment) {
        throw new Error(treatmentResponse?.error ?? 'No pudimos registrar el tratamiento.');
      }

      const payment: Payment = paymentResponse.payment;
      const treatment: Treatment = treatmentResponse.treatment;

      setData((current) =>
        current
          ? {
              ...current,
              payments: [payment, ...current.payments],
              treatments: [treatment, ...current.treatments],
            }
          : current,
      );

      setBudgetAlert({
        type: 'success',
        message: 'Registramos el pago y lo agregamos al historial de tratamientos.',
      });
      closeBudgetPaymentModal();
    } catch (error) {
      setBudgetPaymentError(
        error instanceof Error
          ? error.message
          : 'No pudimos registrar el pago. Intentá nuevamente.',
      );
    } finally {
      setBudgetPaymentSaving(false);
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
    setClinicSelection(data?.patient?.clinicId ?? '');
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
      const payload: Partial<Patient> = { ...formState };

      if (canEditClinicAssignment) {
        payload.clinicId = clinicSelection.trim().length > 0 ? clinicSelection.trim() : null;
      }

      const response = await PatientService.update(data.patient.id, payload);
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

      setPrescriptionAlert({ type: 'success', message: 'Receta generada correctamente.' });

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

  const deletePrescription = async (prescriptionId: string) => {
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

      setPrescriptionAlert({ type: 'success', message: 'Receta eliminada correctamente.' });

      return { success: true };
    } catch (deleteError) {
      setPrescriptionAlert({
        type: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'No pudimos eliminar la receta. Intentá nuevamente.',
      });

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
    const consentNameInput = treatmentForm.consentPatientName.trim();
    const existingConsent = editingTreatmentId ? editingTreatmentConsent : null;
    const resolvedConsentName = consentNameInput || existingConsent?.patientName?.trim() || '';
    const replacingConsent = Boolean(
      treatmentForm.consentFileChanged || treatmentForm.consentSignatureEdited,
    );
    const requireConsentAssets = !editingTreatmentId || !existingConsent || replacingConsent;

    if (!trimmedType || !trimmedDescription || !treatmentForm.date || Number.isNaN(costValue)) {
      setTreatmentError('Completá todos los campos del tratamiento con valores válidos.');
      return;
    }

    if (!resolvedConsentName) {
      setTreatmentError('Indicá el nombre y aclaración del paciente para el consentimiento informado.');
      return;
    }

    if (requireConsentAssets) {
      if (!treatmentForm.consentFile || !treatmentForm.consentSignatureDataUrl) {
        setTreatmentError(
          'Adjuntá el consentimiento informado firmado por el paciente y registrá su firma para continuar.',
        );
        return;
      }
    }

    setTreatmentSaving(true);
    setTreatmentError(null);
    setPageAlert(null);

    try {
      if (editingTreatmentId) {
        const response = await TreatmentService.update({
          id: editingTreatmentId,
          type: trimmedType,
          description: trimmedDescription,
          date: treatmentForm.date,
          cost: costValue,
          consent: {
            patientName: resolvedConsentName,
            replace: replacingConsent,
            file: replacingConsent ? treatmentForm.consentFile : null,
            signatureDataUrl: replacingConsent
              ? treatmentForm.consentSignatureDataUrl
              : null,
          },
        });

        if (!response?.success || !response.treatment) {
          throw new Error(response?.error ?? 'No pudimos actualizar el tratamiento.');
        }

        setData((current) =>
          current
            ? {
                ...current,
                treatments: current.treatments.map((item) =>
                  item.id === response.treatment!.id ? (response.treatment as Treatment) : item,
                ),
              }
            : current,
        );

        setEditingTreatmentConsent(response.treatment.consent ?? null);

        setPageAlert({
          type: 'success',
          message: 'Tratamiento actualizado correctamente.',
        });
      } else {
        if (!treatmentForm.consentFile || !treatmentForm.consentSignatureDataUrl) {
          setTreatmentError('Adjuntá el consentimiento informado y la firma del paciente.');
          return;
        }

        const response = await TreatmentService.create({
          patientId: data.patient.id,
          type: trimmedType,
          description: trimmedDescription,
          date: treatmentForm.date,
          cost: costValue,
          consent: {
            patientName: resolvedConsentName,
            file: treatmentForm.consentFile,
            signatureDataUrl: treatmentForm.consentSignatureDataUrl,
          },
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
      }

      setTreatmentForm(createEmptyTreatmentForm());
      setShowTreatmentForm(false);
      setEditingTreatmentId(null);
      setEditingTreatmentConsent(null);
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

  const handleTreatmentEdit = (treatment: Treatment) => {
    setShowTreatmentForm(true);
    setEditingTreatmentId(treatment.id);
    setTreatmentForm({
      type: treatment.type,
      description: treatment.description,
      cost: treatment.cost.toString(),
      date: treatment.date,
      consentPatientName: treatment.consent?.patientName ?? '',
      consentFile: null,
      consentFileName: treatment.consent?.pdfName ?? '',
      consentSignatureDataUrl: treatment.consent?.patientSignatureUrl ?? null,
      consentFileChanged: false,
      consentSignatureEdited: false,
    });
    setTreatmentError(null);
    setEditingTreatmentConsent(treatment.consent ?? null);
  };

  const handleTreatmentDelete = async (treatment: Treatment) => {
    if (!window.confirm('¿Querés eliminar este tratamiento del historial?')) {
      return;
    }

    try {
      setTreatmentDeletingId(treatment.id);
      const response = await TreatmentService.remove(treatment.id);
      if (!response?.success) {
        throw new Error(response?.error ?? 'No pudimos eliminar el tratamiento.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              treatments: current.treatments.filter((item) => item.id !== treatment.id),
            }
          : current,
      );

      if (editingTreatmentId === treatment.id) {
        setEditingTreatmentId(null);
        setTreatmentForm(createEmptyTreatmentForm());
        setShowTreatmentForm(false);
      }

      setPageAlert({ type: 'success', message: 'Tratamiento eliminado correctamente.' });
    } catch (error) {
      console.error('Error al eliminar tratamiento', error);
      setPageAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'No pudimos eliminar el tratamiento.',
      });
    } finally {
      setTreatmentDeletingId(null);
    }
  };

  const handleMediaUpdated = (asset: ClinicalMedia) => {
    setData((current) =>
      current
        ? {
            ...current,
            media: [
              asset,
              ...current.media.filter(
                (item) => !(item.category === asset.category && item.label === asset.label),
              ),
            ],
          }
        : current,
    );
  };

  const handleMediaRefreshed = (assets: ClinicalMedia[]) => {
    setData((current) => (current ? { ...current, media: assets } : current));
  };

  const handleMediaDeleted = (mediaId: string) => {
    setData((current) =>
      current
        ? {
            ...current,
            media: current.media.filter((item) => item.id !== mediaId),
          }
        : current,
    );
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

  const { patient, appointments, treatments, payments, clinicalHistory, prescriptions, budgets, media } = data;

  return (
    <>
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
            type="button"
            onClick={openPrescriptionModal}
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Receta
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

      {prescriptionAlert && !isPrescriptionModalOpen && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            prescriptionAlert.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {prescriptionAlert.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 rounded-3xl border border-white/10 bg-white/5 p-2 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
        {sectionOptions.map((section) => {
          const isActive = activeSection === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`flex flex-col gap-1 rounded-2xl px-4 py-3 text-left transition ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-sm font-semibold">{section.label}</span>
              <span
                className={`text-[11px] font-medium sm:text-xs ${
                  isActive ? 'text-slate-900/80' : 'text-slate-400'
                }`}
              >
                {section.description}
              </span>
            </button>
          );
        })}
      </div>


{activeSection === 'overview' && (
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
          {canEditClinicAssignment && (
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
              Consultorio asignado
              <select
                name="clinicId"
                value={clinicSelection}
                onChange={handleClinicSelectionChange}
                disabled={clinicOptionsLoading}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              >
                <option value="">Sin consultorio asignado</option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
              {clinicOptionsLoading ? (
                <p className="mt-1 text-[11px] text-slate-400">Cargando consultorios...</p>
              ) : clinicOptionsError ? (
                <p className="mt-1 text-[11px] text-rose-300">{clinicOptionsError}</p>
              ) : null}
            </label>
          )}
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

    <div className="grid gap-6 lg:grid-cols-2">
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
            <dt className="text-slate-400">Consultorio asignado</dt>
            <dd>{patient.clinicName || 'Sin consultorio asignado'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Estado</dt>
            <dd>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  patient.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
                    : 'bg-amber-500/10 text-amber-200 border border-amber-400/40'
                }`}
              >
                {patient.status === 'active' ? 'Activo en seguimiento' : 'Seguimiento pausado'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Próximos turnos</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">{appointments.length} turno(s)</span>
            <button
              type="button"
              onClick={() => setShowAppointmentForm((previous) => !previous)}
              className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
            >
              {showAppointmentForm ? 'Cerrar' : 'Agendar turno'}
            </button>
          </div>
        </div>

        {showAppointmentForm && (
          <div className="mt-4 rounded-2xl border border-cyan-300/40 bg-slate-900/60 p-4 shadow-inner shadow-cyan-500/10">
            <h3 className="text-sm font-semibold text-white">Nuevo turno</h3>
            <p className="mt-1 text-xs text-slate-300">
              El turno se sincroniza automáticamente con Google Calendar del profesional.
            </p>
            <div className="mt-4">
              <AppointmentForm
                patients={[patient]}
                defaultPatientId={patient.id}
                clinics={clinicOptions}
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
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Presupuestos</h2>
            <p className="text-xs text-slate-300">Documentos emitidos para el paciente.</p>
          </div>
          <button
            type="button"
            onClick={openBudgetModalForNew}
            className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Generar presupuesto
          </button>
        </div>

        {budgetAlert && !isBudgetModalOpen && (
          <p
            className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${
              budgetAlert.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            {budgetAlert.message}
          </p>
        )}

        <div className="mt-4 space-y-4">
          {budgets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
              Todavía no emitiste presupuestos para este paciente.
            </p>
          ) : (
            budgets.map((budget) => (
              <div
                key={budget.id}
                className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-cyan-500/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{budget.title}</h3>
                    <p className="text-xs text-slate-400">
                      Emitido el {new Date(budget.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSendBudget(budget)}
                      disabled={budgetSendingId === budget.id || !patientHasEmail}
                      className="rounded-full border border-cyan-400/60 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {budgetSendingId === budget.id ? 'Enviando…' : 'Enviar por mail'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBudgetEdit(budget)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(budget.id)}
                      disabled={budgetDeletingId === budget.id}
                      className="rounded-full border border-rose-400/60 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {budgetDeletingId === budget.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <p>{budget.notes || 'Sin notas adicionales.'}</p>
                  <p className="text-sm text-emerald-300">
                    Total: {currencyFormatter.format(budget.total)}
                  </p>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  {budget.documentUrl && (
                    <a
                      href={budget.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-200/60 hover:text-cyan-100"
                    >
                      Descargar PDF
                    </a>
                  )}
                  {budget.items.length > 0 && (
                    <ul className="space-y-2 rounded-2xl border border-white/5 bg-slate-950/20 p-3">
                      {budget.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {BUDGET_PRACTICES.find((practice) => practice.value === item.practice)?.label ??
                                item.practice}
                            </p>
                            {item.description && (
                              <p className="text-[11px] text-slate-400">{item.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                            <span className="text-emerald-300">
                              {currencyFormatter.format(item.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => openBudgetPaymentModal(budget.id, item.id)}
                              className="rounded-full border border-cyan-400/60 px-3 py-1 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/10"
                            >
                              Registrar pago
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
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
                  setEditingTreatmentId(null);
                  setEditingTreatmentConsent(null);
                  setShowTreatmentForm(false);
                } else {
                  setTreatmentForm(createEmptyTreatmentForm());
                  setTreatmentError(null);
                  setEditingTreatmentId(null);
                  setEditingTreatmentConsent(null);
                  setShowTreatmentForm(true);
                }
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
                <select
                  name="type"
                  value={treatmentForm.type}
                  onChange={handleTreatmentFieldChange}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                >
                  <option value="">Seleccioná el procedimiento</option>
                  {TREATMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {treatmentTypeIsCustom && (
                    <option value={treatmentForm.type}>{treatmentForm.type}</option>
                  )}
                </select>
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

            <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Consentimiento informado
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Adjuntá el consentimiento informado en PDF y registrá la firma digital del paciente para asociarla al tratamiento.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Nombre y aclaración del paciente
                  <input
                    name="consentPatientName"
                    value={treatmentForm.consentPatientName}
                    onChange={handleTreatmentFieldChange}
                    placeholder="Ej: Juan Pérez — DNI 12.345.678"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Documento PDF
                  <div className="mt-2 flex flex-col items-start gap-2 text-[11px] font-normal normal-case text-slate-300 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-100">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleTreatmentConsentFileChange}
                        className="hidden"
                      />
                      <span>Seleccionar archivo</span>
                    </label>
                    {(treatmentForm.consentFileName || editingTreatmentConsent?.pdfName) && (
                      <span className="max-w-[12rem] truncate text-slate-300">
                        {treatmentForm.consentFileName || editingTreatmentConsent?.pdfName}
                      </span>
                    )}
                    {editingTreatmentConsent?.pdfUrl && !treatmentForm.consentFile && (
                      <a
                        href={editingTreatmentConsent.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-200 hover:underline"
                      >
                        Ver documento actual
                      </a>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Firma del paciente</p>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <SignaturePad
                      value={treatmentForm.consentSignatureDataUrl}
                      onChange={handleTreatmentSignatureChange}
                    />
                  </div>
                  {editingTreatmentConsent?.patientSignatureUrl && !treatmentForm.consentSignatureEdited && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Se reutilizará la firma existente. Dibujá nuevamente si necesitás reemplazarla.
                    </p>
                  )}
                </div>
              </div>
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
                {treatmentSaving
                  ? 'Guardando...'
                  : editingTreatmentId
                    ? 'Actualizar tratamiento'
                    : 'Guardar tratamiento'}
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
              {treatment.consent && (
                <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-slate-900/40 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">
                        Consentimiento informado
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Firmado por {treatment.consent.patientName ?? 'Paciente'}{' '}
                        {treatment.consent.signedAt
                          ? `el ${new Date(treatment.consent.signedAt).toLocaleDateString('es-AR')}`
                          : ''}
                      </p>
                    </div>
                    {treatment.consent.pdfUrl && (
                      <a
                        href={treatment.consent.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-cyan-200 hover:underline"
                      >
                        Ver PDF
                      </a>
                    )}
                  </div>
                  {treatment.consent.patientSignatureUrl && (
                    <div className="max-w-[160px]">
                      <Image
                        src={treatment.consent.patientSignatureUrl}
                        alt="Firma del paciente"
                        width={320}
                        height={160}
                        className="h-auto w-full rounded bg-white/5 p-2"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleTreatmentEdit(treatment)}
                  className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleTreatmentDelete(treatment)}
                  disabled={treatmentDeletingId === treatment.id}
                  className="rounded-full border border-rose-400/40 px-3 py-1 font-semibold text-rose-200 transition hover:border-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {treatmentDeletingId === treatment.id ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
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
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">
                  {payment.amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(payment.date).toLocaleDateString('es-AR')} •{' '}
                  {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                </p>
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
  </div>
)}


        {activeSection === 'clinicalHistory' && (
          <div className="space-y-6">
            <ClinicalHistoryForm
              history={clinicalHistory}
              onSubmit={handleClinicalHistorySubmit}
              loading={clinicalSaving}
              mode="without-stages"
            />
          </div>
        )}

      {activeSection === 'orthodonticPlan' && assignedPlan && (
        <div className="space-y-6">
          <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Plan ortodóncico asignado</h2>
                <p className="text-xs text-slate-300">
                  Revisá los objetivos del tratamiento, la aparatología indicada y los tiempos estimados.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
                {assignedPlan.name}
              </div>
            </div>

            <dl className="grid gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-4 text-sm text-slate-200 md:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cuota mensual</dt>
                <dd>{currencyFormatter.format(assignedPlan.monthlyFee)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entrega inicial</dt>
                <dd>
                  {assignedPlan.hasInitialFee
                    ? currencyFormatter.format(assignedPlan.initialFee ?? 0)
                    : 'No requiere entrega'}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asignado el</dt>
                <dd>{new Date(assignedPlan.assignedAt).toLocaleDateString('es-AR')}</dd>
              </div>
            </dl>

            {planDetailsAlert && (
              <p
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  planDetailsAlert.type === 'success'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                }`}
              >
                {planDetailsAlert.message}
              </p>
            )}

            <form onSubmit={handlePlanDetailsSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Objetivo terapéutico
                  <textarea
                    value={planDetails.treatmentGoal}
                    onChange={(event) => handlePlanDetailsChange('treatmentGoal', event.target.value)}
                    rows={4}
                    placeholder="Describí el objetivo principal del tratamiento y metas intermedias."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Aparatología indicada
                  <input
                    value={planDetails.appliance}
                    onChange={(event) => handlePlanDetailsChange('appliance', event.target.value)}
                    placeholder="Tipo de aparatología fija, removible u otros dispositivos."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Frecuencia de controles
                  <input
                    value={planDetails.controlFrequency}
                    onChange={(event) => handlePlanDetailsChange('controlFrequency', event.target.value)}
                    placeholder="Ej. Cada 4 semanas, bimensual, etc."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Duración estimada
                  <input
                    value={planDetails.estimatedDuration}
                    onChange={(event) => handlePlanDetailsChange('estimatedDuration', event.target.value)}
                    placeholder="Ej. 18 meses, 24 meses, etc."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
                <label className="md:col-span-2 space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notas adicionales
                  <textarea
                    value={planDetails.planNotes}
                    onChange={(event) => handlePlanDetailsChange('planNotes', event.target.value)}
                    rows={4}
                    placeholder="Indicaciones complementarias, restricciones o recordatorios para el paciente."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handlePlanDetailsReset}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/40"
                >
                  Restablecer
                </button>
                <button
                  type="submit"
                  disabled={planDetailsSaving}
                  className="rounded-full bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {planDetailsSaving ? 'Guardando…' : 'Guardar plan'}
                </button>
              </div>
            </form>
          </section>

          <ClinicalHistoryForm
            history={clinicalHistory}
            onSubmit={handleClinicalHistorySubmit}
            loading={clinicalSaving}
            mode="stages-only"
            title="Evolución ortodóncica"
            description="Ingresá las mediciones cefalométricas registradas en cada etapa del tratamiento."
            submitLabel="Guardar evolución ortodóncica"
            resetLabel="Restablecer mediciones"
          />
        </div>
      )}

      {activeSection === 'media' && (
        <div className="space-y-6">
          <PatientMediaManager
            patientId={patient.id}
            media={media}
            onMediaUpdated={handleMediaUpdated}
            onMediaRefreshed={handleMediaRefreshed}
            onMediaDeleted={handleMediaDeleted}
          />
        </div>
      )}
    </section>

      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 px-4 py-8">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-xl shadow-cyan-500/20 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {isEditingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}
                </h2>
                <p className="text-sm text-slate-300">Completá los datos para generar el documento en PDF.</p>
              </div>
              <button
                type="button"
                onClick={() => closeBudgetModal()}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            {budgetAlert && (
              <p
                className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${
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
              className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              {isEditingBudget && (
                <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Estás editando un presupuesto existente. Guardá los cambios o cancelá la edición.
                </p>
              )}
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                {isEditingBudget && (
                  <button
                    type="button"
                    onClick={handleCancelBudgetEdit}
                    disabled={budgetSaving}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-200/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar edición
                  </button>
                )}
                <div className="flex flex-1 justify-end gap-3">
                  <button
                    type="submit"
                    disabled={budgetSaving}
                    className="rounded-full bg-cyan-500 px-6 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {budgetSubmitLabel}
                  </button>
                </div>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {budgetPaymentContext && budgetPaymentTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 px-4 py-8">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-xl shadow-cyan-500/20 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Registrar pago de práctica</h2>
                  <p className="text-sm text-slate-300">
                    Al confirmar, el pago se agregará a tu listado de cobranzas y la práctica quedará registrada en el historial de tratamientos del paciente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBudgetPaymentModal}
                  disabled={budgetPaymentSaving}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Presupuesto</p>
                    <p className="font-semibold text-white">{budgetPaymentTarget.budget.title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Práctica</p>
                    <p className="font-semibold text-white">{budgetPaymentPracticeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Importe</p>
                    <p className="font-semibold text-emerald-300">
                      {currencyFormatter.format(budgetPaymentTarget.item.amount)}
                    </p>
                  </div>
                </div>

                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Medio de pago
                  <select
                    value={budgetPaymentMethod}
                    onChange={(event) =>
                      setBudgetPaymentMethod(event.target.value as 'cash' | 'card' | 'transfer')
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                  </select>
                </label>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                      Consentimiento informado
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Adjuntá el consentimiento en PDF y registrá la firma digital del paciente para vincularla al tratamiento creado a partir de este pago.
                    </p>
                  </div>

                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                    Nombre y aclaración del paciente
                    <input
                      value={budgetPaymentConsentName}
                      onChange={(event) => setBudgetPaymentConsentName(event.target.value)}
                      placeholder="Ej: Juan Pérez — DNI 12.345.678"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Archivo PDF</p>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300 hover:bg-cyan-500/10">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleBudgetPaymentConsentFileChange}
                          className="hidden"
                        />
                        <span>Seleccionar archivo</span>
                      </label>
                      {budgetPaymentConsentFileName && (
                        <span className="max-w-[12rem] truncate">{budgetPaymentConsentFileName}</span>
                      )}
                      {budgetPaymentConsentFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetPaymentConsentFile(null);
                            setBudgetPaymentConsentFileName('');
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-rose-300 hover:text-rose-200"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Firma del paciente</p>
                    <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <SignaturePad value={budgetPaymentConsentSignature} onChange={handleBudgetPaymentSignatureChange} />
                    </div>
                  </div>
                </div>
              </div>

              {budgetPaymentError && (
                <p className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {budgetPaymentError}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={closeBudgetPaymentModal}
                  disabled={budgetPaymentSaving}
                  className="rounded-full border border-white/10 px-4 py-2 text-slate-200 transition hover:border-slate-200/60 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBudgetItemPayment}
                  disabled={budgetPaymentSaving}
                  className="rounded-full bg-cyan-500 px-4 py-2 text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {budgetPaymentSaving ? 'Guardando…' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {isPrescriptionModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 px-4 py-6 sm:py-12">
          <div className="flex min-h-full items-center justify-center">
            <div className="relative w-full max-w-4xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-xl shadow-cyan-500/20 backdrop-blur sm:rounded-3xl sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Recetas digitales</h2>
                  <p className="text-sm text-slate-300">
                    Revisá las recetas emitidas o generá un nuevo documento firmado para el paciente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePrescriptionModal}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/10"
                >
                  Cerrar
                </button>
              </div>
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm font-semibold text-slate-200">
                  <button
                    type="button"
                    onClick={() => setPrescriptionModalTab('history')}
                    className={`flex-1 rounded-2xl px-4 py-2 transition ${
                      prescriptionModalTab === 'history'
                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Recetas del paciente ({sortedPrescriptions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrescriptionModalTab('create')}
                    className={`flex-1 rounded-2xl px-4 py-2 transition ${
                      prescriptionModalTab === 'create'
                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Generar nueva receta
                  </button>
                </div>

                <PrescriptionManager
                  key={prescriptionModalTab}
                  prescriptions={prescriptions}
                  onCreate={handleCreatePrescription}
                  hasSavedSignature={signatureInfo.hasSignature}
                  savedSignatureUrl={signatureInfo.signatureUrl}
                  onDelete={deletePrescription}
                  onUpdateSignature={handleUpdateSignature}
                  mode={prescriptionModalTab === 'history' ? 'history' : 'create'}
                  showHistory={prescriptionModalTab === 'history'}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
