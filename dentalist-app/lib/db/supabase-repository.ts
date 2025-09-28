import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import {
  Appointment,
  Budget,
  BudgetItem,
  BudgetPractice,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalMedia,
  ClinicalMediaCategory,
  ClinicalMediaLabel,
  ClinicalStage,
  CreateBudgetInput,
  PatientInvite,
  FamilyHistory,
  MedicalBackground,
  Odontogram,
  OdontogramCondition,
  OdontogramMarkStatus,
  OdontogramSurface,
  OdontogramSurfaceMark,
  OrthodonticPlan,
  Patient,
  Payment,
  Prescription,
  PatientOrthodonticPlan,
  Treatment,
  User,
  ProfessionalProfile,
} from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROFESSIONALS_TABLE =
  process.env.SUPABASE_TABLE_PROFESIONALES ??
  process.env.SUPABASE_TABLE_PROFESSIONALS ??
  'professionals';
const PATIENTS_TABLE =
  process.env.SUPABASE_TABLE_PACIENTES ??
  process.env.SUPABASE_TABLE_PATIENTS ??
  'patients';
const APPOINTMENTS_TABLE =
  process.env.SUPABASE_TABLE_TURNOS ??
  process.env.SUPABASE_TABLE_APPOINTMENTS ??
  'appointments';
const TREATMENTS_TABLE =
  process.env.SUPABASE_TABLE_TRATAMIENTOS ??
  process.env.SUPABASE_TABLE_TREATMENTS ??
  'treatments';
const PAYMENTS_TABLE =
  process.env.SUPABASE_TABLE_PAGOS ??
  process.env.SUPABASE_TABLE_PAYMENTS ??
  'payments';
const TWO_FACTOR_CODES_TABLE =
  process.env.SUPABASE_TABLE_CODIGOS_DOBLE_FACTOR ??
  process.env.SUPABASE_TABLE_TWO_FACTOR_CODES ??
  'two_factor_codes';
const GOOGLE_CREDENTIALS_TABLE =
  process.env.SUPABASE_TABLE_GOOGLE_CREDENTIALS ??
  'professional_google_credentials';
const CLINICAL_HISTORIES_TABLE =
  process.env.SUPABASE_TABLE_CLINICAL_HISTORIES ?? 'clinical_histories';
const CEPHALOMETRIC_RECORDS_TABLE =
  process.env.SUPABASE_TABLE_CEPHALOMETRIC_RECORDS ?? 'cephalometric_records';
const PROFESSIONAL_SIGNATURES_TABLE =
  process.env.SUPABASE_TABLE_PROFESSIONAL_SIGNATURES ?? 'professional_signatures';
const PRESCRIPTIONS_TABLE =
  process.env.SUPABASE_TABLE_PRESCRIPTIONS ?? 'prescriptions';
const ORTHODONTIC_PLANS_TABLE =
  process.env.SUPABASE_TABLE_PLANES_ORTODONCIA ??
  process.env.SUPABASE_TABLE_ORTHODONTIC_PLANS ??
  'orthodontic_plans';
const PATIENT_ORTHODONTIC_PLANS_TABLE =
  process.env.SUPABASE_TABLE_PACIENTES_PLAN_ORTODONCIA ??
  process.env.SUPABASE_TABLE_PATIENT_ORTHODONTIC_PLANS ??
  'patient_orthodontic_plans';
const BUDGETS_TABLE =
  process.env.SUPABASE_TABLE_PRESUPUESTOS ?? process.env.SUPABASE_TABLE_BUDGETS ?? 'budgets';
const BUDGET_ITEMS_TABLE =
  process.env.SUPABASE_TABLE_ITEMS_PRESUPUESTO ??
  process.env.SUPABASE_TABLE_BUDGET_ITEMS ??
  'budget_items';
const DOCUMENTS_BUCKET =
  process.env.SUPABASE_BUCKET_CLINICAL_DOCUMENTS ?? 'clinical-documents';
const CLINICAL_MEDIA_TABLE =
  process.env.SUPABASE_TABLE_CLINICAL_MEDIA ?? 'clinical_media';
const MEDIA_BUCKET = process.env.SUPABASE_BUCKET_CLINICAL_MEDIA ?? 'clinical-media';
const SIGNATURES_BUCKET =
  process.env.SUPABASE_BUCKET_PROFESSIONAL_SIGNATURES ??
  'professional-signatures';
const PROFESSIONAL_LOGOS_BUCKET =
  process.env.SUPABASE_BUCKET_PROFESSIONAL_LOGOS ?? 'professional-logos';
const PATIENT_INVITES_TABLE =
  process.env.SUPABASE_TABLE_PACIENTE_INVITACIONES ??
  process.env.SUPABASE_TABLE_PATIENT_INVITES ??
  'patient_invites';

const CLINICAL_STAGES: ClinicalStage[] = ['initial', 'intermediate', 'final'];
const ODONTOGRAM_CONDITIONS: OdontogramCondition[] = [
  'caries',
  'extraction',
  'sealant',
  'crown',
  'endodontic',
];
const ODONTOGRAM_SURFACES: OdontogramSurface[] = [
  'mesial',
  'distal',
  'occlusal',
  'vestibular',
  'lingual',
  'whole',
  'crown',
];
const ODONTOGRAM_STATUSES: OdontogramMarkStatus[] = ['planned', 'completed'];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeFileName(fileName: string | null | undefined): string | null {
  if (!fileName) {
    return null;
  }

  const trimmed = fileName.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(-128);
}

function resolveFileExtension(
  fileName: string | null | undefined,
  mimeType: string | null | undefined,
): string {
  const namePart = fileName?.split('.').pop();
  if (namePart && /^[a-zA-Z0-9]+$/.test(namePart)) {
    return namePart.toLowerCase();
  }

  if (!mimeType) {
    return 'bin';
  }

  const normalized = mimeType.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('heic')) return 'heic';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('pdf')) return 'pdf';

  return 'bin';
}

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase no está configurado. Asegúrate de definir NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const bucketChecks = new Map<string, Promise<void>>();

function isBucketMissing(error: { message?: string; status?: number; statusCode?: string }) {
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.status === 404 ||
    error.statusCode === '404' ||
    message.includes('not found') ||
    message.includes('does not exist')
  );
}

function isBucketAlreadyCreated(error: { message?: string; status?: number; statusCode?: string }) {
  const message = error.message?.toLowerCase() ?? '';
  return error.status === 409 || error.statusCode === '409' || message.includes('already exists');
}

async function ensureBucketExists(client: ReturnType<typeof getClient>, bucket: string) {
  if (!bucketChecks.has(bucket)) {
    const checkPromise = (async () => {
      const { data, error } = await client.storage.getBucket(bucket);

      if (!error && data) {
        return;
      }

      if (error && !isBucketMissing(error)) {
        throw error;
      }

      const { error: createError } = await client.storage.createBucket(bucket, { public: false });

      if (createError && !isBucketAlreadyCreated(createError)) {
        throw createError;
      }
    })().catch((ensureError) => {
      bucketChecks.delete(bucket);
      throw ensureError;
    });

    bucketChecks.set(bucket, checkPromise);
  }

  const ensure = bucketChecks.get(bucket);
  if (ensure) {
    await ensure;
  }
}

async function createSignedUrl(
  client: ReturnType<typeof getClient>,
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  await ensureBucketExists(client, bucket);

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error('No pudimos generar una URL firmada de Supabase', error);
    return null;
  }

  return data?.signedUrl ?? null;
}

type AppProfessionalRow = {
  id: string;
  dni: string | null;
  full_name: string | null;
  email: string | null;
  clinic_name: string | null;
  license_number: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  province: string | null;
  locality: string | null;
  logo_path: string | null;
  updated_at: string | null;
};

type AppPatientRow = {
  id: string;
  dni: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  health_insurance: string | null;
  afiliado: string | null;
  status: string;
};

type AppAppointmentRow = {
  id: string;
  patient_id: string | null;
  title: string;
  status: string;
  start_at: string;
  end_at: string;
  google_event_id?: string | null;
};

type AppTreatmentRow = {
  id: string;
  patient_id: string;
  professional_id?: string;
  type?: string | null;
  title?: string | null;
  description: string | null;
  cost?: number | string | null;
  treatment_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
};

type AppPaymentRow = {
  id: string;
  patient_id: string;
  professional_id?: string;
  amount: number | string | null;
  method: string | null;
  status: string | null;
  payment_date?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  notes: string | null;
};

type AppPatientInviteRow = {
  id: string;
  professional_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
};

type AppGoogleCredentialRow = {
  professional_id: string;
  google_user_id: string;
  email: string | null;
  calendar_id: string | null;
  access_token: string;
  refresh_token: string;
  scope: string | null;
  token_type: string | null;
  expiry_date: string | null;
  updated_at?: string | null;
};

type AppClinicalHistoryRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  summary: string | null;
  reason_for_consultation: string | null;
  medical_background: Record<string, unknown> | null;
  family_history: Record<string, unknown> | null;
  allergies: string | null;
  odontogram: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  cephalometric_records?: AppCephalometricRecordRow[] | null;
};

type AppCephalometricRecordRow = {
  id: string;
  clinical_history_id: string;
  stage: ClinicalStage;
  biotipo: string | null;
  patron_esqueletal: string | null;
  sna: string | null;
  snb: string | null;
  anb: string | null;
  na_mm: string | null;
  na_angle: string | null;
  nb_mm: string | null;
  nb_angle: string | null;
  plano_mandibular: string | null;
  recorded_at: string | null;
};

type AppPrescriptionRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  title: string;
  diagnosis: string | null;
  medication: string;
  instructions: string;
  notes: string | null;
  document_path: string;
  signature_path: string | null;
  created_at: string;
  updated_at: string;
};

type AppProfessionalSignatureRow = {
  professional_id: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  updated_at: string;
  created_at: string;
};

type AppClinicalMediaRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  category: string;
  label: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  valid_until: string | null;
  notes: string | null;
};

type AppOrthodonticPlanRow = {
  id: string;
  professional_id: string;
  name: string;
  monthly_fee: number | string;
  has_initial_fee: boolean;
  initial_fee: number | string | null;
  created_at: string;
  updated_at: string;
};

type AppPatientOrthodonticPlanRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  plan_id: string;
  plan_name: string;
  monthly_fee: number | string;
  has_initial_fee: boolean;
  initial_fee: number | string | null;
  assigned_at: string;
};

type AppBudgetItemRow = {
  id: string;
  budget_id: string;
  practice: string;
  description: string | null;
  amount: number | string | null;
  created_at?: string | null;
};

type AppBudgetRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  title: string;
  notes: string | null;
  total: number | string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
  items?: AppBudgetItemRow[] | null;
};

function mapProfessionalProfile(row: AppProfessionalRow): ProfessionalProfile {
  return {
    id: row.id,
    dni: row.dni ?? null,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    clinicName: row.clinic_name ?? null,
    licenseNumber: row.license_number ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    country: row.country ?? null,
    province: row.province ?? null,
    locality: row.locality ?? null,
    logoPath: row.logo_path ?? null,
    logoUrl: null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapPatient(record: AppPatientRow): Patient {
  return {
    id: record.id,
    dni: record.dni ?? '',
    name: record.first_name,
    lastName: record.last_name,
    email: record.email ?? '',
    phone: record.phone ?? '',
    address: record.address ?? '',
    healthInsurance: record.health_insurance ?? 'Particular',
    affiliateNumber: record.afiliado ?? undefined,
    status: (record.status as Patient['status']) ?? 'active',
  };
}

function mapAppointment(record: AppAppointmentRow): Appointment {
  const start = new Date(record.start_at);

  return {
    id: record.id,
    patientId: record.patient_id ?? '',
    date: start.toISOString().split('T')[0],
    time: `${start.getHours().toString().padStart(2, '0')}:${start
      .getMinutes()
      .toString()
      .padStart(2, '0')}`,
    type: record.title,
    status: (record.status as Appointment['status']) ?? 'confirmed',
    startAt: new Date(record.start_at).toISOString(),
    endAt: new Date(record.end_at ?? record.start_at).toISOString(),
    googleEventId: record.google_event_id ?? undefined,
  };
}

function mapTreatment(record: AppTreatmentRow): Treatment {
  const rawDate =
    record.treatment_date ?? record.start_date ?? record.end_date ?? record.created_at ?? new Date().toISOString();
  const normalizedDate = new Date(rawDate).toISOString().split('T')[0];

  return {
    id: record.id,
    patientId: record.patient_id,
    type: (record.type ?? record.title ?? 'Tratamiento').toString(),
    description: record.description ?? '',
    cost: Number(record.cost ?? 0),
    date: normalizedDate,
  };
}

function mapPayment(record: AppPaymentRow): Payment {
  const rawDate = record.payment_date ?? record.paid_at ?? record.created_at ?? new Date().toISOString();
  return {
    id: record.id,
    patientId: record.patient_id,
    amount: Number(record.amount ?? 0),
    method: (record.method as Payment['method']) ?? 'other',
    status: (record.status as Payment['status']) ?? 'completed',
    date: new Date(rawDate).toISOString(),
    notes: record.notes ?? undefined,
  };
}

function mapPatientInvite(row: AppPatientInviteRow): PatientInvite {
  return {
    id: row.id,
    professionalId: row.professional_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    usedAt: row.used_at ?? null,
  };
}

function mapMedicalBackground(value: unknown): MedicalBackground | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const background: MedicalBackground = {
    personalHistory: getOptionalString(value['personal_history']),
    systemicConditions: getOptionalString(value['systemic_conditions']),
    medications: getOptionalString(value['medications']),
    surgicalHistory: getOptionalString(value['surgical_history']),
    notes: getOptionalString(value['notes']),
  };

  return Object.values(background).some((entry) => typeof entry === 'string' && entry.length > 0)
    ? background
    : null;
}

function mapFamilyHistory(value: unknown): FamilyHistory | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const family: FamilyHistory = {
    father: getOptionalString(value['father']),
    mother: getOptionalString(value['mother']),
    siblings: getOptionalString(value['siblings']),
    others: getOptionalString(value['others']),
  };

  return Object.values(family).some((entry) => typeof entry === 'string' && entry.length > 0) ? family : null;
}

function isValidOdontogramCondition(value: unknown): value is OdontogramCondition {
  return typeof value === 'string' && (ODONTOGRAM_CONDITIONS as string[]).includes(value);
}

function isValidOdontogramSurface(value: unknown): value is OdontogramSurface {
  return typeof value === 'string' && (ODONTOGRAM_SURFACES as string[]).includes(value);
}

function isValidOdontogramStatus(value: unknown): value is OdontogramMarkStatus {
  return typeof value === 'string' && (ODONTOGRAM_STATUSES as string[]).includes(value);
}

function mapOdontogram(value: unknown): Odontogram | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const odontogram: Odontogram = {};

  for (const [tooth, rawState] of Object.entries(value)) {
    if (!isPlainRecord(rawState)) {
      continue;
    }

    const toothState: Record<string, OdontogramSurfaceMark> = {};

    for (const [surfaceKey, rawMark] of Object.entries(rawState)) {
      if (!isValidOdontogramSurface(surfaceKey) || !isPlainRecord(rawMark)) {
        continue;
      }

      const condition = (rawMark as Record<string, unknown>).condition;
      const status = (rawMark as Record<string, unknown>).status;

      if (!isValidOdontogramCondition(condition) || !isValidOdontogramStatus(status)) {
        continue;
      }

      toothState[surfaceKey] = {
        condition,
        status,
      };
    }

    if (Object.keys(toothState).length === 0) {
      for (const condition of ODONTOGRAM_CONDITIONS) {
        if (rawState[condition] === true) {
          const fallbackMark: OdontogramSurfaceMark = {
            condition,
            status: 'planned',
          };
          toothState['whole'] = fallbackMark;
          break;
        }
      }
    }

    if (Object.keys(toothState).length > 0) {
      odontogram[tooth] = toothState as Record<OdontogramSurface, OdontogramSurfaceMark>;
    }
  }

  return Object.keys(odontogram).length > 0 ? odontogram : null;
}

function normalizeString(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMedicalBackground(
  input: ClinicalHistoryInput['medicalBackground'],
): Record<string, string> | null {
  if (!input) {
    return null;
  }

  const normalized: Record<string, string> = {};

  const personalHistory = normalizeString(input.personalHistory);
  if (personalHistory) normalized.personal_history = personalHistory;

  const systemicConditions = normalizeString(input.systemicConditions);
  if (systemicConditions) normalized.systemic_conditions = systemicConditions;

  const medications = normalizeString(input.medications);
  if (medications) normalized.medications = medications;

  const surgicalHistory = normalizeString(input.surgicalHistory);
  if (surgicalHistory) normalized.surgical_history = surgicalHistory;

  const notes = normalizeString(input.notes);
  if (notes) normalized.notes = notes;

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeFamilyHistory(
  input: ClinicalHistoryInput['familyHistory'],
): Record<string, string> | null {
  if (!input) {
    return null;
  }

  const normalized: Record<string, string> = {};

  const father = normalizeString(input.father);
  if (father) normalized.father = father;

  const mother = normalizeString(input.mother);
  if (mother) normalized.mother = mother;

  const siblings = normalizeString(input.siblings);
  if (siblings) normalized.siblings = siblings;

  const others = normalizeString(input.others);
  if (others) normalized.others = others;

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeOdontogram(
  input: ClinicalHistoryInput['odontogram'],
): Record<string, Record<OdontogramSurface, OdontogramSurfaceMark>> | null {
  if (!input) {
    return null;
  }

  const normalized: Record<string, Record<OdontogramSurface, OdontogramSurfaceMark>> = {};

  for (const [tooth, state] of Object.entries(input)) {
    if (!state) {
      continue;
    }

    const toothState: Record<OdontogramSurface, OdontogramSurfaceMark> = {} as Record<
      OdontogramSurface,
      OdontogramSurfaceMark
    >;

    for (const surface of ODONTOGRAM_SURFACES) {
      const mark = state[surface];
      if (!mark) {
        continue;
      }

      if (!isValidOdontogramCondition(mark.condition) || !isValidOdontogramStatus(mark.status)) {
        continue;
      }

      toothState[surface] = {
        condition: mark.condition,
        status: mark.status,
      };
    }

    if (Object.keys(toothState).length > 0) {
      normalized[tooth] = toothState;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function mapClinicalHistory(row: AppClinicalHistoryRow): ClinicalHistory {
  const stages: ClinicalHistory['stages'] = {};

  for (const record of row.cephalometric_records ?? []) {
    stages[record.stage] = {
      stage: record.stage,
      biotipo: record.biotipo ?? undefined,
      patronEsqueletal: record.patron_esqueletal ?? undefined,
      sna: record.sna ?? undefined,
      snb: record.snb ?? undefined,
      anb: record.anb ?? undefined,
      naMm: record.na_mm ?? undefined,
      naAngle: record.na_angle ?? undefined,
      nbMm: record.nb_mm ?? undefined,
      nbAngle: record.nb_angle ?? undefined,
      planoMandibular: record.plano_mandibular ?? undefined,
      recordedAt: record.recorded_at ?? undefined,
    };
  }

  const medicalBackground = mapMedicalBackground(row.medical_background);
  const familyHistory = mapFamilyHistory(row.family_history);
  const odontogram = mapOdontogram(row.odontogram);

  return {
    id: row.id,
    patientId: row.patient_id,
    summary: row.summary,
    reasonForConsultation: getOptionalString(row.reason_for_consultation) ?? null,
    medicalBackground: medicalBackground ?? null,
    familyHistory: familyHistory ?? null,
    allergies: getOptionalString(row.allergies) ?? null,
    odontogram: odontogram ?? null,
    stages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrescription(row: AppPrescriptionRow, pdfUrl: string): Prescription {
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    diagnosis: row.diagnosis ?? undefined,
    medication: row.medication,
    instructions: row.instructions,
    notes: row.notes ?? undefined,
    pdfUrl,
    signaturePath: row.signature_path ?? undefined,
    createdAt: row.created_at,
  };
}

const CLINICAL_MEDIA_CATEGORIES: ClinicalMediaCategory[] = ['photo', 'radiograph', 'document'];
const CLINICAL_MEDIA_LABELS: ClinicalMediaLabel[] = [
  'frente',
  'perfil',
  'derecho',
  'izquierdo',
  'panoramica',
  'teleradiografia',
  'inicial',
  'final',
  'otros',
  'intraoral_superior',
  'intraoral_inferior',
];

function mapClinicalMedia(row: AppClinicalMediaRow, signedUrl: string | null): ClinicalMedia {
  const category = CLINICAL_MEDIA_CATEGORIES.includes(row.category as ClinicalMediaCategory)
    ? (row.category as ClinicalMediaCategory)
    : 'photo';
  const label = CLINICAL_MEDIA_LABELS.includes(row.label as ClinicalMediaLabel)
    ? (row.label as ClinicalMediaLabel)
    : 'otros';

  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    category,
    label,
    fileName: row.file_name ?? null,
    mimeType: row.mime_type ?? null,
    fileSize: row.file_size ?? null,
    url: signedUrl ?? '',
    uploadedAt: row.uploaded_at,
    validUntil: row.valid_until,
  };
}

function mapOrthodonticPlan(row: AppOrthodonticPlanRow): OrthodonticPlan {
  return {
    id: row.id,
    professionalId: row.professional_id,
    name: row.name,
    monthlyFee: Number(row.monthly_fee ?? 0),
    hasInitialFee: Boolean(row.has_initial_fee),
    initialFee: row.initial_fee !== null && row.initial_fee !== undefined ? Number(row.initial_fee) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPatientOrthodonticPlan(row: AppPatientOrthodonticPlanRow): PatientOrthodonticPlan {
  return {
    id: row.id,
    professionalId: row.professional_id,
    patientId: row.patient_id,
    planId: row.plan_id,
    name: row.plan_name,
    monthlyFee: Number(row.monthly_fee ?? 0),
    hasInitialFee: Boolean(row.has_initial_fee),
    initialFee: row.initial_fee !== null && row.initial_fee !== undefined ? Number(row.initial_fee) : null,
    assignedAt: row.assigned_at,
  };
}

function mapBudgetItem(row: AppBudgetItemRow): BudgetItem {
  return {
    id: row.id,
    budgetId: row.budget_id,
    practice: row.practice as BudgetPractice,
    description: row.description ?? undefined,
    amount: Number(row.amount ?? 0),
  };
}

function mapBudget(row: AppBudgetRow, documentUrl?: string | null): Budget {
  const items = (row.items ?? []).map(mapBudgetItem);
  return {
    id: row.id,
    professionalId: row.professional_id,
    patientId: row.patient_id,
    title: row.title,
    notes: row.notes ?? undefined,
    total: Number(row.total ?? 0),
    documentUrl: documentUrl ?? row.document_path ?? undefined,
    createdAt: row.created_at,
    items,
  };
}

export async function registerProfessional(data: {
  dni: string;
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const client = getClient();
  const { dni, name, email, password } = data;

  const { data: existing } = await client
    .from(PROFESSIONALS_TABLE)
    .select('id, dni')
    .or(`dni.eq.${dni},email.eq.${email}`)
    .maybeSingle();

  if (existing) {
    throw new Error('Ya existe un profesional con ese DNI o correo');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      dni,
      full_name: name,
      role: 'professional',
    },
  });

  if (authError || !authData.user) {
    throw new Error(
      authError?.message ??
        'No pudimos crear la cuenta en Supabase Auth. Verifica que el correo no esté registrado.',
    );
  }

  const professionalId = authData.user.id;

  const { data: inserted, error } = await client
    .from(PROFESSIONALS_TABLE)
    .insert({
      id: professionalId,
      user_id: professionalId,
      dni,
      full_name: name,
      email,
      password_hash: passwordHash,
    })
    .select('*')
    .single();

  if (error) {
    await client.auth.admin.deleteUser(professionalId);
    throw error;
  }

  return {
    id: inserted.id,
    dni: inserted.dni,
    name: inserted.full_name,
    email: inserted.email,
    type: 'profesional',
    clinicName: (inserted as { clinic_name?: string | null }).clinic_name ?? null,
    licenseNumber: (inserted as { license_number?: string | null }).license_number ?? null,
    phone: (inserted as { phone?: string | null }).phone ?? null,
    address: (inserted as { address?: string | null }).address ?? null,
    country: (inserted as { country?: string | null }).country ?? null,
    province: (inserted as { province?: string | null }).province ?? null,
    locality: (inserted as { locality?: string | null }).locality ?? null,
  };
}

export type StoredAuthUser = {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: User['type'];
  passwordHash: string | null;
  clinicName: string | null;
  licenseNumber: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  province: string | null;
  locality: string | null;
};

export async function findUserByDni(
  dni: string,
  type: User['type'],
): Promise<StoredAuthUser | null> {
  const client = getClient();
  if (type === 'profesional') {
    const { data, error } = await client
      .from(PROFESSIONALS_TABLE)
      .select('*')
      .eq('dni', dni)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      dni: data.dni,
      name: data.full_name,
      email: data.email,
      type: 'profesional' as const,
      passwordHash: data.password_hash,
      clinicName: data.clinic_name ?? null,
      licenseNumber: data.license_number ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      country: data.country ?? null,
      province: data.province ?? null,
      locality: data.locality ?? null,
    };
  }

  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .select('*')
    .eq('dni', dni)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    dni: data.dni,
    name: `${data.first_name} ${data.last_name}`.trim(),
    email: data.email ?? '',
    type: 'paciente' as const,
    passwordHash: data.password_hash ?? null,
    clinicName: null,
    licenseNumber: null,
    phone: null,
    address: null,
    country: null,
    province: null,
    locality: null,
  };
}

type StoredTwoFactor = {
  id: string;
  professional_id: string | null;
  patient_id: string | null;
  email: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export async function storeTwoFactorCode(
  user: StoredAuthUser,
  code: string,
  ttlMinutes = 5,
) {
  const client = getClient();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const codeHash = await bcrypt.hash(code, 10);

  const payload = {
    professional_id: user.type === 'profesional' ? user.id : null,
    patient_id: user.type === 'paciente' ? user.id : null,
    email: user.email,
    code_hash: codeHash,
    expires_at: expiresAt,
  };

  const { error } = await client.from(TWO_FACTOR_CODES_TABLE).insert(payload);

  if (error) throw error;
}

export async function validateTwoFactorCode(user: StoredAuthUser, code: string) {
  const client = getClient();

  const userColumn = user.type === 'profesional' ? 'professional_id' : 'patient_id';

  const { data, error } = await client
    .from(TWO_FACTOR_CODES_TABLE)
    .select('*')
    .eq(userColumn, user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<StoredTwoFactor>();

  if (error) throw error;
  if (!data) {
    return { valid: false, reason: 'Código no solicitado' } as const;
  }

  if (data.consumed_at) {
    return { valid: false, reason: 'Código ya utilizado' } as const;
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: 'Código expirado' } as const;
  }

  const valid = await bcrypt.compare(code, data.code_hash);
  if (!valid) {
    return { valid: false, reason: 'Código incorrecto' } as const;
  }

  await client
    .from(TWO_FACTOR_CODES_TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id);

  return { valid: true } as const;
}

export type ProfessionalProfileUpdate = {
  fullName?: string | null;
  clinicName?: string | null;
  licenseNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  province?: string | null;
  locality?: string | null;
};

export async function getProfessionalProfile(professionalId: string): Promise<ProfessionalProfile | null> {
  const client = getClient();

  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .select(
      'id, dni, full_name, email, clinic_name, license_number, phone, address, country, province, locality, logo_path, updated_at',
    )
    .eq('id', professionalId)
    .maybeSingle<AppProfessionalRow>();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const profile = mapProfessionalProfile(data);
  if (profile.logoPath) {
    profile.logoUrl =
      (await createSignedUrl(client, PROFESSIONAL_LOGOS_BUCKET, profile.logoPath)) ?? null;
  } else {
    profile.logoUrl = null;
  }
  return profile;
}

export async function updateProfessionalProfile(
  professionalId: string,
  updates: ProfessionalProfileUpdate,
): Promise<ProfessionalProfile> {
  const client = getClient();

  const normalize = (value: string | null | undefined): string | null | undefined => {
    if (value === null) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return undefined;
  };

  const payload: Record<string, string | null | undefined> = {};

  const fullName = normalize(updates.fullName);
  if (fullName !== undefined) {
    payload.full_name = fullName;
  }

  const clinicName = normalize(updates.clinicName);
  if (clinicName !== undefined) {
    payload.clinic_name = clinicName;
  }

  const licenseNumber = normalize(updates.licenseNumber);
  if (licenseNumber !== undefined) {
    payload.license_number = licenseNumber;
  }

  const phone = normalize(updates.phone);
  if (phone !== undefined) {
    payload.phone = phone;
  }

  const address = normalize(updates.address);
  if (address !== undefined) {
    payload.address = address;
  }

  const country = normalize(updates.country);
  if (country !== undefined) {
    payload.country = country;
  }

  const province = normalize(updates.province);
  if (province !== undefined) {
    payload.province = province;
  }

  const locality = normalize(updates.locality);
  if (locality !== undefined) {
    payload.locality = locality;
  }

  if (Object.keys(payload).length === 0) {
    const existing = await getProfessionalProfile(professionalId);
    if (!existing) {
      throw new Error('Profesional no encontrado');
    }
    return existing;
  }

  payload.updated_at = new Date().toISOString();

  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .update(payload)
    .eq('id', professionalId)
    .select(
      'id, dni, full_name, email, clinic_name, license_number, phone, address, country, province, locality, logo_path, updated_at',
    )
    .maybeSingle<AppProfessionalRow>();

  if (error) throw error;
  if (!data) {
    throw new Error('Profesional no encontrado');
  }

  const profile = mapProfessionalProfile(data);
  if (profile.logoPath) {
    profile.logoUrl =
      (await createSignedUrl(client, PROFESSIONAL_LOGOS_BUCKET, profile.logoPath)) ?? null;
  } else {
    profile.logoUrl = null;
  }
  return profile;
}

export async function listPatients(
  professionalId: string,
  filters: { search?: string; status?: string } = {},
): Promise<Patient[]> {
  const client = getClient();
  let query = client
    .from(PATIENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: true });

  if (filters.status === 'active' || filters.status === 'inactive') {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,dni.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AppPatientRow[];
  return rows.map(mapPatient);
}

export async function createPatient(
  professionalId: string,
  patient: Omit<Patient, 'id'>,
): Promise<Patient> {
  const client = getClient();
  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .insert({
      professional_id: professionalId,
      dni: patient.dni,
      first_name: patient.name,
      last_name: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      health_insurance: patient.healthInsurance,
      afiliado: patient.affiliateNumber,
      status: patient.status,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapPatient(data as AppPatientRow);
}

export async function getPatientById(
  professionalId: string,
  patientId: string,
): Promise<Patient | null> {
  const client = getClient();
  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .select('*')
    .eq('id', patientId)
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPatient(data as AppPatientRow) : null;
}

export async function updatePatient(
  professionalId: string,
  patientId: string,
  updates: Partial<Patient>,
): Promise<Patient | null> {
  const client = getClient();
  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .update({
      dni: updates.dni,
      first_name: updates.name,
      last_name: updates.lastName,
      email: updates.email,
      phone: updates.phone,
      address: updates.address,
      health_insurance: updates.healthInsurance,
      afiliado: updates.affiliateNumber,
      status: updates.status,
    })
    .eq('id', patientId)
    .eq('professional_id', professionalId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? mapPatient(data as AppPatientRow) : null;
}

export async function removePatient(
  professionalId: string,
  patientId: string,
): Promise<boolean> {
  const client = getClient();
  const { error } = await client
    .from(PATIENTS_TABLE)
    .delete()
    .eq('id', patientId)
    .eq('professional_id', professionalId);
  if (error) throw error;
  return true;
}

export async function createPatientInvite(
  professionalId: string,
  expiresAt: Date,
): Promise<{ invite: PatientInvite; token: string }> {
  const client = getClient();
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data, error } = await client
    .from(PATIENT_INVITES_TABLE)
    .insert({
      professional_id: professionalId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    invite: mapPatientInvite(data as AppPatientInviteRow),
    token,
  };
}

export async function listOrthodonticPlans(professionalId: string): Promise<OrthodonticPlan[]> {
  const client = getClient();
  const { data, error } = await client
    .from(ORTHODONTIC_PLANS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapOrthodonticPlan(row as AppOrthodonticPlanRow));
}

export async function createOrthodonticPlan(
  professionalId: string,
  plan: {
    name: string;
    monthlyFee: number;
    hasInitialFee: boolean;
    initialFee?: number | null;
  },
): Promise<OrthodonticPlan> {
  const client = getClient();
  const { data, error } = await client
    .from(ORTHODONTIC_PLANS_TABLE)
    .insert({
      professional_id: professionalId,
      name: plan.name,
      monthly_fee: plan.monthlyFee,
      has_initial_fee: plan.hasInitialFee,
      initial_fee: plan.hasInitialFee ? plan.initialFee ?? 0 : null,
    })
    .select('*')
    .single();

  if (error) throw error;

  return mapOrthodonticPlan(data as AppOrthodonticPlanRow);
}

export async function updateOrthodonticPlan(
  professionalId: string,
  planId: string,
  updates: Partial<{
    name: string;
    monthlyFee: number;
    hasInitialFee: boolean;
    initialFee: number | null;
  }>,
): Promise<OrthodonticPlan | null> {
  const client = getClient();
  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    payload['name'] = updates.name;
  }
  if (updates.monthlyFee !== undefined) {
    payload['monthly_fee'] = updates.monthlyFee;
  }
  if (updates.hasInitialFee !== undefined) {
    payload['has_initial_fee'] = updates.hasInitialFee;
    if (!updates.hasInitialFee) {
      payload['initial_fee'] = null;
    } else if (updates.initialFee !== undefined) {
      payload['initial_fee'] = updates.initialFee ?? 0;
    }
  }
  if (updates.initialFee !== undefined && updates.hasInitialFee === undefined) {
    payload['initial_fee'] = updates.initialFee;
  }

  if (Object.keys(payload).length === 0) {
    const { data } = await client
      .from(ORTHODONTIC_PLANS_TABLE)
      .select('*')
      .eq('professional_id', professionalId)
      .eq('id', planId)
      .maybeSingle();
    return data ? mapOrthodonticPlan(data as AppOrthodonticPlanRow) : null;
  }

  const { data, error } = await client
    .from(ORTHODONTIC_PLANS_TABLE)
    .update(payload)
    .eq('professional_id', professionalId)
    .eq('id', planId)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  return data ? mapOrthodonticPlan(data as AppOrthodonticPlanRow) : null;
}

export async function deleteOrthodonticPlan(
  professionalId: string,
  planId: string,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(ORTHODONTIC_PLANS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('id', planId);

  if (error) throw error;
}

export async function assignOrthodonticPlanToPatient(
  professionalId: string,
  patientId: string,
  planId: string,
): Promise<PatientOrthodonticPlan> {
  const client = getClient();

  const { data: plan, error: planError } = await client
    .from(ORTHODONTIC_PLANS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('id', planId)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) {
    throw new Error('Plan de ortodoncia no encontrado');
  }

  const initialFeeValue = (plan as AppOrthodonticPlanRow).has_initial_fee
    ? (plan as AppOrthodonticPlanRow).initial_fee ?? 0
    : null;

  const { data, error } = await client
    .from(PATIENT_ORTHODONTIC_PLANS_TABLE)
    .upsert(
      {
        professional_id: professionalId,
        patient_id: patientId,
        plan_id: planId,
        plan_name: (plan as AppOrthodonticPlanRow).name,
        monthly_fee: (plan as AppOrthodonticPlanRow).monthly_fee,
        has_initial_fee: (plan as AppOrthodonticPlanRow).has_initial_fee,
        initial_fee: initialFeeValue,
      },
      { onConflict: 'patient_id' },
    )
    .select('*')
    .single();

  if (error) throw error;

  return mapPatientOrthodonticPlan(data as AppPatientOrthodonticPlanRow);
}

export async function getPatientOrthodonticPlan(
  professionalId: string,
  patientId: string,
): Promise<PatientOrthodonticPlan | null> {
  const client = getClient();
  const { data, error } = await client
    .from(PATIENT_ORTHODONTIC_PLANS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) throw error;

  return data ? mapPatientOrthodonticPlan(data as AppPatientOrthodonticPlanRow) : null;
}

export async function removePatientOrthodonticPlan(
  professionalId: string,
  patientId: string,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(PATIENT_ORTHODONTIC_PLANS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId);

  if (error) throw error;
}

export async function listBudgets(
  professionalId: string,
  patientId: string,
): Promise<Budget[]> {
  const client = getClient();
  const { data, error } = await client
    .from(BUDGETS_TABLE)
    .select('*, items:budget_items(*)')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as AppBudgetRow[];
  const signedUrls = await Promise.all(
    rows.map((row) =>
      row.document_path
        ? createSignedUrl(client, DOCUMENTS_BUCKET, row.document_path)
        : Promise.resolve<string | null>(null),
    ),
  );

  return rows.map((row, index) => mapBudget(row, signedUrls[index] ?? undefined));
}

export async function getBudgetById(
  professionalId: string,
  patientId: string,
  budgetId: string,
): Promise<Budget | null> {
  const client = getClient();
  const { data, error } = await client
    .from(BUDGETS_TABLE)
    .select('*, items:budget_items(*)')
    .eq('professional_id', professionalId)
    .eq('id', budgetId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const row = data as AppBudgetRow;
  if (row.patient_id !== patientId) {
    return null;
  }

  const signedUrl = row.document_path
    ? await createSignedUrl(client, DOCUMENTS_BUCKET, row.document_path)
    : null;

  return mapBudget(row, signedUrl ?? undefined);
}

export async function createBudgetRecord(
  professionalId: string,
  patientId: string,
  payload: { budget: CreateBudgetInput; pdfBuffer: Buffer },
): Promise<Budget> {
  const client = getClient();
  const total = payload.budget.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const { data: inserted, error: insertError } = await client
    .from(BUDGETS_TABLE)
    .insert({
      professional_id: professionalId,
      patient_id: patientId,
      title: payload.budget.title,
      notes: payload.budget.notes ?? null,
      total,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error('No pudimos crear el presupuesto');
  }

  const budgetRow = inserted as AppBudgetRow;
  const budgetId = budgetRow.id;

  try {
    if (payload.budget.items.length > 0) {
      const { error: itemsError } = await client.from(BUDGET_ITEMS_TABLE).insert(
        payload.budget.items.map((item) => ({
          budget_id: budgetId,
          practice: item.practice,
          description: item.description ?? null,
          amount: item.amount,
        })),
      );

      if (itemsError) throw itemsError;
    }

    await ensureBucketExists(client, DOCUMENTS_BUCKET);
    const storagePath = `${professionalId}/patients/${patientId}/budgets/${budgetId}.pdf`;

    const { error: uploadError } = await client.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, payload.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await client
      .from(BUDGETS_TABLE)
      .update({ document_path: storagePath, total })
      .eq('professional_id', professionalId)
      .eq('id', budgetId)
      .select('*, items:budget_items(*)')
      .single();

    if (updateError || !updated) {
      throw updateError ?? new Error('No pudimos guardar el documento del presupuesto');
    }

    const signedUrl = await createSignedUrl(client, DOCUMENTS_BUCKET, storagePath);
    return mapBudget(updated as AppBudgetRow, signedUrl ?? undefined);
  } catch (error) {
    await client
      .from(BUDGETS_TABLE)
      .delete()
      .eq('professional_id', professionalId)
      .eq('id', budgetId);
    throw error;
  }
}

export async function updateBudgetRecord(
  professionalId: string,
  patientId: string,
  budgetId: string,
  payload: { budget: CreateBudgetInput; pdfBuffer: Buffer },
): Promise<Budget> {
  const client = getClient();
  const total = payload.budget.items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const { data: existing, error: fetchError } = await client
    .from(BUDGETS_TABLE)
    .select('id, patient_id, document_path')
    .eq('professional_id', professionalId)
    .eq('id', budgetId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing || existing.patient_id !== patientId) {
    throw new Error('Presupuesto no encontrado');
  }

  const documentPath = existing.document_path ?? `${professionalId}/patients/${patientId}/budgets/${budgetId}.pdf`;

  const { error: updateError } = await client
    .from(BUDGETS_TABLE)
    .update({
      title: payload.budget.title,
      notes: payload.budget.notes ?? null,
      total,
    })
    .eq('professional_id', professionalId)
    .eq('id', budgetId);

  if (updateError) throw updateError;

  const { error: deleteItemsError } = await client.from(BUDGET_ITEMS_TABLE).delete().eq('budget_id', budgetId);
  if (deleteItemsError) throw deleteItemsError;

  if (payload.budget.items.length > 0) {
    const { error: insertItemsError } = await client.from(BUDGET_ITEMS_TABLE).insert(
      payload.budget.items.map((item) => ({
        budget_id: budgetId,
        practice: item.practice,
        description: item.description ?? null,
        amount: item.amount,
      })),
    );

    if (insertItemsError) throw insertItemsError;
  }

  await ensureBucketExists(client, DOCUMENTS_BUCKET);
  const { error: uploadError } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .upload(documentPath, payload.pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: updatedRow, error: refreshedError } = await client
    .from(BUDGETS_TABLE)
    .select('*, items:budget_items(*)')
    .eq('professional_id', professionalId)
    .eq('id', budgetId)
    .single();

  if (refreshedError || !updatedRow) {
    throw refreshedError ?? new Error('No pudimos obtener el presupuesto actualizado');
  }

  const signedUrl = await createSignedUrl(client, DOCUMENTS_BUCKET, documentPath);
  return mapBudget(updatedRow as AppBudgetRow, signedUrl ?? undefined);
}

export async function deleteBudgetRecord(
  professionalId: string,
  patientId: string,
  budgetId: string,
): Promise<void> {
  const client = getClient();
  const { data: existing, error: fetchError } = await client
    .from(BUDGETS_TABLE)
    .select('id, patient_id, document_path')
    .eq('professional_id', professionalId)
    .eq('id', budgetId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing || existing.patient_id !== patientId) {
    throw new Error('Presupuesto no encontrado');
  }

  await client.from(BUDGET_ITEMS_TABLE).delete().eq('budget_id', budgetId);
  await client
    .from(BUDGETS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('id', budgetId);

  if (existing.document_path) {
    await client.storage.from(DOCUMENTS_BUCKET).remove([existing.document_path]);
  }
}

export async function listAppointments(professionalId: string, patientId?: string) {
  const client = getClient();
  let query = client
    .from(APPOINTMENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .order('start_at');
  if (patientId) {
    query = query.eq('patient_id', patientId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AppAppointmentRow[];
  return rows.map(mapAppointment);
}

export async function getAppointmentById(professionalId: string, appointmentId: string) {
  const client = getClient();
  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAppointment(data as AppAppointmentRow) : null;
}

export async function createAppointment(
  professionalId: string,
  appointment: {
    patientId?: string;
    title: string;
    status: Appointment['status'];
    startAt: string;
    endAt: string;
  },
) {
  const client = getClient();
  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .insert({
      professional_id: professionalId,
      patient_id: appointment.patientId ?? null,
      title: appointment.title,
      status: appointment.status,
      start_at: appointment.startAt,
      end_at: appointment.endAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapAppointment(data as AppAppointmentRow);
}

export async function attachAppointmentGoogleEvent(
  professionalId: string,
  appointmentId: string,
  googleEventId: string,
) {
  const client = getClient();
  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .update({ google_event_id: googleEventId })
    .eq('professional_id', professionalId)
    .eq('id', appointmentId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data ? mapAppointment(data as AppAppointmentRow) : null;
}

export interface ProfessionalGoogleCredentials {
  professionalId: string;
  googleUserId: string;
  email: string | null;
  calendarId: string | null;
  accessToken: string;
  refreshToken: string;
  scope: string | null;
  tokenType: string | null;
  expiryDate: string | null;
  updatedAt?: string | null;
}

export async function getProfessionalGoogleCredentials(
  professionalId: string,
): Promise<ProfessionalGoogleCredentials | null> {
  const client = getClient();
  const { data, error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  const record = data as AppGoogleCredentialRow;
  return {
    professionalId: record.professional_id,
    googleUserId: record.google_user_id,
    email: record.email,
    calendarId: record.calendar_id,
    accessToken: record.access_token,
    refreshToken: record.refresh_token,
    scope: record.scope,
    tokenType: record.token_type,
    expiryDate: record.expiry_date,
    updatedAt: record.updated_at ?? undefined,
  };
}

export async function upsertProfessionalGoogleCredentials(
  professionalId: string,
  credentials: Omit<ProfessionalGoogleCredentials, 'professionalId' | 'updatedAt'>,
) {
  const client = getClient();
  const { error } = await client.from(GOOGLE_CREDENTIALS_TABLE).upsert(
    {
      professional_id: professionalId,
      google_user_id: credentials.googleUserId,
      email: credentials.email,
      calendar_id: credentials.calendarId,
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      scope: credentials.scope,
      token_type: credentials.tokenType,
      expiry_date: credentials.expiryDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'professional_id' },
  );

  if (error) throw error;
}

export async function deleteProfessionalGoogleCredentials(professionalId: string) {
  const client = getClient();
  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .delete()
    .eq('professional_id', professionalId);

  if (error) throw error;
}

export async function updateAppointment(
  professionalId: string,
  appointmentId: string,
  updates: Partial<Appointment> & { date?: string; time?: string; type?: string },
) {
  const client = getClient();
  const { data: currentRow, error: fetchError } = await client
    .from(APPOINTMENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('id', appointmentId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  const current = currentRow as AppAppointmentRow | null;
  if (!current) return null;

  const payload: Partial<AppAppointmentRow> = {};

  if (updates.patientId !== undefined) {
    payload.patient_id = updates.patientId ?? null;
  }

  if (updates.status) {
    payload.status = updates.status;
  }

  if (updates.type) {
    payload.title = updates.type;
  }

  if (updates.date || updates.time) {
    const startDate = new Date(current.start_at);
    const endDate = new Date(current.end_at);

    if (updates.date) {
      const [year, month, day] = updates.date.split('-').map(Number);
      startDate.setFullYear(year, (month ?? 1) - 1, day);
    }

    if (updates.time) {
      const [hours, minutes] = updates.time.split(':').map(Number);
      startDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    }

    const duration = endDate.getTime() - new Date(current.start_at).getTime();
    const newEnd = new Date(startDate.getTime() + duration);
    payload.start_at = startDate.toISOString();
    payload.end_at = newEnd.toISOString();
  }

  if (Object.keys(payload).length === 0) {
    return mapAppointment(current);
  }

  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .update(payload)
    .eq('professional_id', professionalId)
    .eq('id', appointmentId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data ? mapAppointment(data as AppAppointmentRow) : null;
}

export async function deleteAppointment(
  professionalId: string,
  appointmentId: string,
) {
  const client = getClient();
  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('id', appointmentId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? mapAppointment(data as AppAppointmentRow) : null;
}

export async function listTreatments(
  professionalId: string,
  patientId?: string,
) {
  const client = getClient();
  let query = client
    .from(TREATMENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (patientId) {
    query = query.eq('patient_id', patientId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AppTreatmentRow[];
  return rows.map(mapTreatment);
}

export async function createTreatment(
  professionalId: string,
  treatment: Omit<Treatment, 'id'>,
) {
  const client = getClient();
  const { data, error } = await client
    .from(TREATMENTS_TABLE)
    .insert({
      professional_id: professionalId,
      patient_id: treatment.patientId,
      title: treatment.type,
      description: treatment.description,
      cost: treatment.cost,
      start_date: treatment.date,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapTreatment(data as AppTreatmentRow);
}

export async function updateTreatment(
  professionalId: string,
  treatmentId: string,
  updates: { type: string; description: string; cost: number; date: string },
): Promise<Treatment> {
  const client = getClient();
  const { data, error } = await client
    .from(TREATMENTS_TABLE)
    .update({
      title: updates.type,
      description: updates.description,
      cost: updates.cost,
      start_date: updates.date,
    })
    .eq('professional_id', professionalId)
    .eq('id', treatmentId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Tratamiento no encontrado');
  }

  return mapTreatment(data as AppTreatmentRow);
}

export async function deleteTreatment(professionalId: string, treatmentId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(TREATMENTS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('id', treatmentId);

  if (error) throw error;
}

export async function listPayments(
  professionalId: string,
  patientId?: string,
) {
  const client = getClient();
  let query = client
    .from(PAYMENTS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .order('paid_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (patientId) {
    query = query.eq('patient_id', patientId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AppPaymentRow[];
  return rows.map(mapPayment);
}

export async function createPayment(
  professionalId: string,
  payment: Omit<Payment, 'id'>,
) {
  const client = getClient();
  const { data, error } = await client
    .from(PAYMENTS_TABLE)
    .insert({
      professional_id: professionalId,
      patient_id: payment.patientId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      paid_at: payment.date,
      notes: payment.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapPayment(data as AppPaymentRow);
}

export async function updatePayment(
  professionalId: string,
  paymentId: string,
  updates: { amount: number; method: Payment['method']; status: Payment['status']; date: string; notes?: string | null },
): Promise<Payment> {
  const client = getClient();
  const { data, error } = await client
    .from(PAYMENTS_TABLE)
    .update({
      amount: updates.amount,
      method: updates.method,
      status: updates.status,
      paid_at: updates.date,
      notes: updates.notes ?? null,
    })
    .eq('professional_id', professionalId)
    .eq('id', paymentId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Pago no encontrado');
  }

  return mapPayment(data as AppPaymentRow);
}

export async function deletePayment(professionalId: string, paymentId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(PAYMENTS_TABLE)
    .delete()
    .eq('professional_id', professionalId)
    .eq('id', paymentId);

  if (error) throw error;
}

export async function getClinicalHistory(
  professionalId: string,
  patientId: string,
): Promise<ClinicalHistory | null> {
  const client = getClient();
  const { data, error } = await client
    .from(CLINICAL_HISTORIES_TABLE)
    .select('*, cephalometric_records(*)')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return null;
  }

  return mapClinicalHistory(data as AppClinicalHistoryRow);
}

export async function upsertClinicalHistory(
  professionalId: string,
  patientId: string,
  input: ClinicalHistoryInput,
): Promise<ClinicalHistory | null> {
  const client = getClient();
  const summary = normalizeString(input.summary);
  const reasonForConsultation = normalizeString(input.reasonForConsultation);
  const allergies = normalizeString(input.allergies);
  const medicalBackground = normalizeMedicalBackground(input.medicalBackground);
  const familyHistory = normalizeFamilyHistory(input.familyHistory);
  const odontogram = normalizeOdontogram(input.odontogram);
  const { data: existing, error: existingError } = await client
    .from(CLINICAL_HISTORIES_TABLE)
    .select('id')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (existingError) throw existingError;

  let historyId: string;

  if (existing) {
    const { error: updateError } = await client
      .from(CLINICAL_HISTORIES_TABLE)
      .update({
        summary,
        reason_for_consultation: reasonForConsultation,
        allergies,
        medical_background: medicalBackground,
        family_history: familyHistory,
        odontogram,
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    historyId = existing.id;
  } else {
    const { data: created, error: insertError } = await client
      .from(CLINICAL_HISTORIES_TABLE)
      .insert({
        professional_id: professionalId,
        patient_id: patientId,
        summary,
        reason_for_consultation: reasonForConsultation,
        allergies,
        medical_background: medicalBackground,
        family_history: familyHistory,
        odontogram,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    historyId = (created as { id: string }).id;
  }

  const stageEntries = Object.entries(input.stages ?? {}) as [
    ClinicalStage,
    ClinicalHistoryInput['stages'][ClinicalStage],
  ][];

  const upserts: Array<Record<string, unknown>> = [];
  const deletions: ClinicalStage[] = [];

  for (const [stage, values] of stageEntries) {
    if (!CLINICAL_STAGES.includes(stage)) {
      continue;
    }

    const normalized = {
      biotipo: values?.biotipo?.trim() || null,
      patron_esqueletal: values?.patronEsqueletal?.trim() || null,
      sna: values?.sna?.trim() || null,
      snb: values?.snb?.trim() || null,
      anb: values?.anb?.trim() || null,
      na_mm: values?.naMm?.trim() || null,
      na_angle: values?.naAngle?.trim() || null,
      nb_mm: values?.nbMm?.trim() || null,
      nb_angle: values?.nbAngle?.trim() || null,
      plano_mandibular: values?.planoMandibular?.trim() || null,
    };

    const hasValue = Object.values(normalized).some((value) => value && value.toString().length > 0);

    if (!hasValue) {
      deletions.push(stage);
      continue;
    }

    upserts.push({
      clinical_history_id: historyId,
      stage,
      ...normalized,
      recorded_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await client
      .from(CEPHALOMETRIC_RECORDS_TABLE)
      .upsert(upserts, { onConflict: 'clinical_history_id,stage' });
    if (upsertError) throw upsertError;
  }

  if (deletions.length > 0) {
    const { error: deleteError } = await client
      .from(CEPHALOMETRIC_RECORDS_TABLE)
      .delete()
      .eq('clinical_history_id', historyId)
      .in('stage', deletions);
    if (deleteError) throw deleteError;
  }

  return getClinicalHistory(professionalId, patientId);
}

export async function listPatientMedia(
  professionalId: string,
  patientId: string,
): Promise<ClinicalMedia[]> {
  const client = getClient();
  const { data, error } = await client
    .from(CLINICAL_MEDIA_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .order('category', { ascending: true })
    .order('label', { ascending: true })
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as AppClinicalMediaRow[];
  const signedUrls = await Promise.all(
    rows.map((row) => createSignedUrl(client, MEDIA_BUCKET, row.storage_path, 900)),
  );

  return rows.map((row, index) => mapClinicalMedia(row, signedUrls[index] ?? null));
}

export async function savePatientMedia(
  professionalId: string,
  patientId: string,
  payload: {
    buffer: Buffer;
    fileName?: string | null;
    mimeType?: string | null;
    category: ClinicalMediaCategory;
    label: ClinicalMediaLabel;
    validUntil?: string | null;
    notes?: string | null;
  },
): Promise<ClinicalMedia> {
  const client = getClient();
  const sanitizedOriginalName = sanitizeFileName(payload.fileName);
  const extension = resolveFileExtension(payload.fileName ?? null, payload.mimeType ?? null);
  const storageFileName = `${payload.label}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storagePath = `${professionalId}/patients/${patientId}/${payload.category}/${storageFileName}`;

  const { data: existingRowsData, error: existingError } = await client
    .from(CLINICAL_MEDIA_TABLE)
    .select('id, storage_path')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .eq('category', payload.category)
    .eq('label', payload.label);

  if (existingError) throw existingError;

  await ensureBucketExists(client, MEDIA_BUCKET);

  const { error: uploadError } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, payload.buffer, {
      contentType: payload.mimeType ?? 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from(CLINICAL_MEDIA_TABLE)
    .insert({
      patient_id: patientId,
      professional_id: professionalId,
      category: payload.category,
      label: payload.label,
      storage_path: storagePath,
      file_name: sanitizedOriginalName ?? storageFileName,
      mime_type: payload.mimeType ?? 'application/octet-stream',
      file_size: payload.buffer.byteLength,
      uploaded_by: professionalId,
      valid_until: payload.validUntil ?? null,
      notes: payload.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;

  const existingRows = (existingRowsData ?? []) as Array<{ id: string; storage_path: string | null }>;

  if (existingRows.length > 0) {
    const previousIds = existingRows.map((row) => row.id);
    const previousPaths = existingRows
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path));

    if (previousIds.length > 0) {
      const { error: deleteRowsError } = await client
        .from(CLINICAL_MEDIA_TABLE)
        .delete()
        .in('id', previousIds);

      if (deleteRowsError) {
        console.warn('No se pudieron eliminar las imágenes anteriores', deleteRowsError);
      }
    }

    if (previousPaths.length > 0) {
      const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove(previousPaths);
      if (removeError) {
        console.warn('No se pudieron eliminar los archivos anteriores del storage', removeError);
      }
    }
  }

  const signedUrl = await createSignedUrl(client, MEDIA_BUCKET, storagePath, 900);
  return mapClinicalMedia(data as AppClinicalMediaRow, signedUrl ?? null);
}

export async function deletePatientMedia(
  professionalId: string,
  patientId: string,
  mediaId: string,
): Promise<void> {
  const client = getClient();

  const { data, error } = await client
    .from(CLINICAL_MEDIA_TABLE)
    .select('id, storage_path')
    .eq('id', mediaId)
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Archivo clínico no encontrado');
  }

  const { error: deleteError } = await client
    .from(CLINICAL_MEDIA_TABLE)
    .delete()
    .eq('id', mediaId)
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId);

  if (deleteError) throw deleteError;

  const storagePath = (data as { storage_path: string | null }).storage_path;

  if (storagePath) {
    const { error: storageError } = await client.storage.from(MEDIA_BUCKET).remove([storagePath]);
    if (storageError) {
      console.warn('No se pudo eliminar el archivo clínico del storage', storageError);
    }
  }
}

export async function listPrescriptions(
  professionalId: string,
  patientId: string,
): Promise<Prescription[]> {
  const client = getClient();
  const { data, error } = await client
    .from(PRESCRIPTIONS_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as AppPrescriptionRow[];
  const signedUrls = await Promise.all(
    rows.map((row) => createSignedUrl(client, DOCUMENTS_BUCKET, row.document_path)),
  );

  return rows.map((row, index) => mapPrescription(row, signedUrls[index] ?? ''));
}

export async function createPrescriptionRecord(
  professionalId: string,
  patientId: string,
  payload: {
    title: string;
    diagnosis?: string | null;
    medication: string;
    instructions: string;
    notes?: string | null;
    pdfBuffer: Buffer;
    signaturePath?: string | null;
  },
): Promise<Prescription> {
  const client = getClient();
  const fileName = `${new Date().toISOString().split('T')[0]}-${crypto.randomUUID()}.pdf`;
  const storagePath = `${professionalId}/patients/${patientId}/prescriptions/${fileName}`;

  await ensureBucketExists(client, DOCUMENTS_BUCKET);

  const { error: uploadError } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, payload.pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from(PRESCRIPTIONS_TABLE)
    .insert({
      patient_id: patientId,
      professional_id: professionalId,
      title: payload.title,
      diagnosis: payload.diagnosis ?? null,
      medication: payload.medication,
      instructions: payload.instructions,
      notes: payload.notes ?? null,
      document_path: storagePath,
      signature_path: payload.signaturePath ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;

  const signedUrl = await createSignedUrl(client, DOCUMENTS_BUCKET, storagePath);
  return mapPrescription(data as AppPrescriptionRow, signedUrl ?? '');
}

export async function deletePrescriptionRecord(
  professionalId: string,
  patientId: string,
  prescriptionId: string,
): Promise<void> {
  const client = getClient();

  const { data: existing, error: fetchError } = await client
    .from(PRESCRIPTIONS_TABLE)
    .select('id, document_path')
    .eq('id', prescriptionId)
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) {
    throw new Error('Receta no encontrada');
  }

  const { error: deleteError } = await client
    .from(PRESCRIPTIONS_TABLE)
    .delete()
    .eq('id', prescriptionId)
    .eq('professional_id', professionalId)
    .eq('patient_id', patientId);

  if (deleteError) throw deleteError;

  const documentPath = (existing as { document_path: string | null }).document_path;

  if (documentPath) {
    const { error: storageError } = await client.storage
      .from(DOCUMENTS_BUCKET)
      .remove([documentPath]);

    if (storageError) {
      console.warn('No se pudo eliminar el PDF de la receta', storageError);
    }
  }
}

export async function getProfessionalLogo(
  professionalId: string,
  options: { signedUrlExpiresIn?: number } = {},
): Promise<{ storagePath: string; signedUrl: string | null; updatedAt: string | null } | null> {
  const client = getClient();

  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .select('logo_path, updated_at')
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw error;
  const record = data as { logo_path: string | null; updated_at: string | null } | null;
  if (!record || !record.logo_path) {
    return null;
  }

  const signedUrl = await createSignedUrl(
    client,
    PROFESSIONAL_LOGOS_BUCKET,
    record.logo_path,
    options.signedUrlExpiresIn ?? 3600,
  );

  return {
    storagePath: record.logo_path,
    signedUrl,
    updatedAt: record.updated_at ?? null,
  };
}

export async function saveProfessionalLogo(
  professionalId: string,
  file: { buffer: Buffer; mimeType: string },
): Promise<{ storagePath: string; signedUrl: string | null }> {
  const client = getClient();
  const mimeType = file.mimeType?.startsWith('image/') ? file.mimeType : 'image/png';
  if (mimeType !== 'image/png') {
    throw new Error('El logo debe estar en formato PNG.');
  }

  const storagePath = `${professionalId}/logo.png`;

  await ensureBucketExists(client, PROFESSIONAL_LOGOS_BUCKET);

  const { error: uploadError } = await client.storage
    .from(PROFESSIONAL_LOGOS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { error: updateError } = await client
    .from(PROFESSIONALS_TABLE)
    .update({ logo_path: storagePath, updated_at: new Date().toISOString() })
    .eq('id', professionalId);

  if (updateError) throw updateError;

  const signedUrl = await createSignedUrl(client, PROFESSIONAL_LOGOS_BUCKET, storagePath);
  return { storagePath, signedUrl };
}

export async function deleteProfessionalLogo(professionalId: string): Promise<void> {
  const client = getClient();

  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .select('logo_path')
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw error;
  const record = data as { logo_path: string | null } | null;
  const storagePath = record?.logo_path ?? null;

  const { error: updateError } = await client
    .from(PROFESSIONALS_TABLE)
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq('id', professionalId);

  if (updateError) throw updateError;

  if (storagePath) {
    await ensureBucketExists(client, PROFESSIONAL_LOGOS_BUCKET);
    const { error: removeError } = await client.storage
      .from(PROFESSIONAL_LOGOS_BUCKET)
      .remove([storagePath]);
    if (removeError) {
      console.warn('No se pudo eliminar el logo del profesional del storage', removeError);
    }
  }
}

export async function downloadProfessionalLogo(
  professionalId: string,
): Promise<{ buffer: Buffer; mimeType: string; storagePath: string } | null> {
  const client = getClient();
  const logo = await getProfessionalLogo(professionalId);
  if (!logo?.storagePath) {
    return null;
  }

  await ensureBucketExists(client, PROFESSIONAL_LOGOS_BUCKET);

  const { data, error } = await client.storage
    .from(PROFESSIONAL_LOGOS_BUCKET)
    .download(logo.storagePath);

  if (error) throw error;
  if (!data) {
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: 'image/png',
    storagePath: logo.storagePath,
  };
}

export async function getProfessionalSignature(
  professionalId: string,
  options: { signedUrlExpiresIn?: number } = {},
): Promise<(AppProfessionalSignatureRow & { signedUrl: string | null }) | null> {
  const client = getClient();
  const { data, error } = await client
    .from(PROFESSIONAL_SIGNATURES_TABLE)
    .select('*')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const row = data as AppProfessionalSignatureRow;
  const signedUrl = await createSignedUrl(
    client,
    SIGNATURES_BUCKET,
    row.storage_path,
    options.signedUrlExpiresIn ?? 3600,
  );

  return { ...row, signedUrl };
}

export async function saveProfessionalSignature(
  professionalId: string,
  file: { buffer: Buffer; mimeType: string },
): Promise<{ storagePath: string; signedUrl: string | null }> {
  const client = getClient();
  const mimeType = file.mimeType?.startsWith('image/') ? file.mimeType : 'image/png';
  const extension = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? 'jpg'
      : 'png';
  const storagePath = `${professionalId}/signature.${extension}`;

  await ensureBucketExists(client, SIGNATURES_BUCKET);

  const { error: uploadError } = await client.storage
    .from(SIGNATURES_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { error: upsertError } = await client
    .from(PROFESSIONAL_SIGNATURES_TABLE)
    .upsert(
      {
        professional_id: professionalId,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: file.buffer.byteLength,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'professional_id' },
    );

  if (upsertError) throw upsertError;

  const signedUrl = await createSignedUrl(client, SIGNATURES_BUCKET, storagePath);
  return { storagePath, signedUrl };
}

export async function downloadProfessionalSignature(
  professionalId: string,
): Promise<{ buffer: Buffer; mimeType: string; storagePath: string } | null> {
  const client = getClient();
  const signature = await getProfessionalSignature(professionalId);
  if (!signature) {
    return null;
  }

  await ensureBucketExists(client, SIGNATURES_BUCKET);

  const { data, error } = await client.storage
    .from(SIGNATURES_BUCKET)
    .download(signature.storage_path);

  if (error) throw error;
  if (!data) {
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: signature.mime_type ?? 'image/png',
    storagePath: signature.storage_path,
  };
}

export function toPublicUser(user: {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: User['type'];
  clinicName?: string | null;
  licenseNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  province?: string | null;
  locality?: string | null;
  logoUrl?: string | null;
}): User {
  return {
    id: user.id,
    dni: user.dni,
    name: user.name,
    email: user.email,
    type: user.type,
    clinicName: user.clinicName ?? null,
    licenseNumber: user.licenseNumber ?? null,
    phone: user.phone ?? null,
    address: user.address ?? null,
    country: user.country ?? null,
    province: user.province ?? null,
    locality: user.locality ?? null,
    logoUrl: user.logoUrl ?? null,
  };
}
