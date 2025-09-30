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
  Clinic,
  StaffMember,
  StaffInvitation,
  StaffInvitationStatus,
  StaffRole,
  StaffStatus,
  EncryptedPayload,
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
  ProfessionalKeyStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/types';
import {
  DEFAULT_TIME_ZONE,
  formatDateTimeInTimeZone,
  normalizeTimeZone,
  parseDateTimeInTimeZone,
} from '@/lib/utils/timezone';
import { ensureSubscriptionStatus, TRIAL_DURATION_DAYS } from '@/lib/utils/subscription';

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
const ENCRYPTED_PLACEHOLDER = '[encriptado]';

function hashSensitiveValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function maskIfPresent(value: string | null | undefined): string | null {
  return value && value.trim() ? ENCRYPTED_PLACEHOLDER : null;
}
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
const PROFESSIONAL_KEYS_TABLE =
  process.env.SUPABASE_TABLE_PROFESSIONAL_KEYS ?? 'professional_keys';
const CLINICS_TABLE =
  process.env.SUPABASE_TABLE_CONSULTORIOS ??
  process.env.SUPABASE_TABLE_CLINICS ??
  'clinics';
const STAFF_MEMBERS_TABLE =
  process.env.SUPABASE_TABLE_STAFF_MEMBERS ?? 'staff_members';
const STAFF_INVITATIONS_TABLE =
  process.env.SUPABASE_TABLE_STAFF_INVITATIONS ?? 'staff_invitations';

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

function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'pro') {
      return 'pro';
    }
  }
  return 'starter';
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

const ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? null;
const PROFESSIONAL_KEY_LENGTH = 32;
const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 16;

type ProfessionalKeyRow = {
  professional_id: string;
  encrypted_key: string;
  key_iv: string;
  version: number;
  created_at: string;
  updated_at: string;
  rotated_at: string;
};

const professionalKeyCache = new Map<string, { key: Buffer; metadata: ProfessionalKeyStatus }>();

function getMasterKeyBuffer(): Buffer {
  if (!ENCRYPTION_MASTER_KEY) {
    throw new Error(
      'No encontramos ENCRYPTION_MASTER_KEY. Configurá la variable en Vercel y Supabase para habilitar el cifrado.',
    );
  }

  const buffer = Buffer.from(ENCRYPTION_MASTER_KEY, 'base64');
  if (buffer.length !== PROFESSIONAL_KEY_LENGTH) {
    throw new Error('ENCRYPTION_MASTER_KEY debe tener 32 bytes codificados en base64.');
  }

  return buffer;
}

function buildMetadata(row: ProfessionalKeyRow): ProfessionalKeyStatus {
  return {
    professionalId: row.professional_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rotatedAt: row.rotated_at,
  };
}

function encryptWithKey(key: Buffer, plaintext: Buffer) {
  const iv = crypto.randomBytes(AES_GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, tag]);

  return {
    ciphertext: payload.toString('base64'),
    iv: iv.toString('base64'),
  };
}

function decryptWithKey(key: Buffer, ciphertext: string, iv: string): Buffer {
  const payload = Buffer.from(ciphertext, 'base64');
  if (payload.length <= AES_GCM_TAG_LENGTH) {
    throw new Error('El texto cifrado es demasiado corto.');
  }

  const authTag = payload.subarray(payload.length - AES_GCM_TAG_LENGTH);
  const encrypted = payload.subarray(0, payload.length - AES_GCM_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function getProfessionalKeyFromCache(professionalId: string) {
  return professionalKeyCache.get(professionalId) ?? null;
}

function setProfessionalKeyCache(professionalId: string, value: { key: Buffer; metadata: ProfessionalKeyStatus }) {
  professionalKeyCache.set(professionalId, value);
}

async function fetchProfessionalKeyRow(client: ReturnType<typeof getClient>, professionalId: string) {
  const { data, error } = await client
    .from(PROFESSIONAL_KEYS_TABLE)
    .select('professional_id, encrypted_key, key_iv, version, created_at, updated_at, rotated_at')
    .eq('professional_id', professionalId)
    .maybeSingle<ProfessionalKeyRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function insertProfessionalKeyRow(
  client: ReturnType<typeof getClient>,
  professionalId: string,
  encrypted: { ciphertext: string; iv: string },
) {
  const { data, error } = await client
    .from(PROFESSIONAL_KEYS_TABLE)
    .insert({
      professional_id: professionalId,
      encrypted_key: encrypted.ciphertext,
      key_iv: encrypted.iv,
      version: 1,
    })
    .select('professional_id, encrypted_key, key_iv, version, created_at, updated_at, rotated_at')
    .single<ProfessionalKeyRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProfessionalKeyRow(
  client: ReturnType<typeof getClient>,
  professionalId: string,
  encrypted: { ciphertext: string; iv: string },
  version: number,
) {
  const { data, error } = await client
    .from(PROFESSIONAL_KEYS_TABLE)
    .update({
      encrypted_key: encrypted.ciphertext,
      key_iv: encrypted.iv,
      version,
      rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('professional_id', professionalId)
    .select('professional_id, encrypted_key, key_iv, version, created_at, updated_at, rotated_at')
    .single<ProfessionalKeyRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function resolveProfessionalKey(professionalId: string) {
  const cached = getProfessionalKeyFromCache(professionalId);
  if (cached) {
    return { key: Buffer.from(cached.key), metadata: cached.metadata };
  }

  const client = getClient();
  const masterKey = getMasterKeyBuffer();
  let row = await fetchProfessionalKeyRow(client, professionalId);
  let keyBuffer: Buffer;

  if (!row) {
    const generated = crypto.randomBytes(PROFESSIONAL_KEY_LENGTH);
    const encrypted = encryptWithKey(masterKey, generated);
    row = await insertProfessionalKeyRow(client, professionalId, encrypted);
    keyBuffer = generated;
  } else {
    const decrypted = decryptWithKey(masterKey, row.encrypted_key, row.key_iv);
    if (decrypted.length !== PROFESSIONAL_KEY_LENGTH) {
      throw new Error('La clave maestra del profesional tiene un tamaño inválido.');
    }
    keyBuffer = decrypted;
  }

  const metadata = buildMetadata(row);
  setProfessionalKeyCache(professionalId, { key: Buffer.from(keyBuffer), metadata });

  return { key: Buffer.from(keyBuffer), metadata };
}

export async function getProfessionalEncryptionKeyStatus(
  professionalId: string,
): Promise<ProfessionalKeyStatus | null> {
  const client = getClient();
  const row = await fetchProfessionalKeyRow(client, professionalId);
  return row ? buildMetadata(row) : null;
}

export async function ensureProfessionalEncryptionKey(
  professionalId: string,
): Promise<ProfessionalKeyStatus> {
  const { metadata } = await resolveProfessionalKey(professionalId);
  return metadata;
}

export async function rotateProfessionalEncryptionKey(
  professionalId: string,
): Promise<ProfessionalKeyStatus> {
  const { metadata } = await resolveProfessionalKey(professionalId);
  const client = getClient();
  const masterKey = getMasterKeyBuffer();
  const generated = crypto.randomBytes(PROFESSIONAL_KEY_LENGTH);
  const encrypted = encryptWithKey(masterKey, generated);
  const nextVersion = metadata.version + 1;
  const row = await updateProfessionalKeyRow(client, professionalId, encrypted, nextVersion);
  const updatedMetadata = buildMetadata(row);
  setProfessionalKeyCache(professionalId, { key: Buffer.from(generated), metadata: updatedMetadata });
  return updatedMetadata;
}

export async function encryptSensitivePayload(
  professionalId: string,
  payload: unknown,
): Promise<EncryptedPayload> {
  const { key, metadata } = await resolveProfessionalKey(professionalId);
  const serialized =
    typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(JSON.stringify(payload ?? null), 'utf8');
  const encrypted = encryptWithKey(key, serialized);
  return {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    version: metadata.version,
  };
}

export async function decryptSensitivePayload<T = unknown>(
  professionalId: string,
  payload: EncryptedPayload,
): Promise<T> {
  const { key, metadata } = await resolveProfessionalKey(professionalId);
  if (payload.version !== metadata.version) {
    throw new Error(
      `La versión de la clave (${payload.version}) no coincide con la activa (${metadata.version}). Necesitás recifrar el dato antes de leerlo.`,
    );
  }

  const decrypted = decryptWithKey(key, payload.ciphertext, payload.iv);
  const text = decrypted.toString('utf8');

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

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
  time_zone?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_locked_at?: string | null;
};

type AppPatientRow = {
  id: string;
  dni: string | null;
  dni_hash?: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  health_insurance: string | null;
  afiliado: string | null;
  status: string;
  professional_id: string;
  clinic_name?: string | null;
  clinic_id?: string | null;
  contact_payload_ciphertext?: string | null;
  contact_payload_iv?: string | null;
  contact_payload_version?: number | null;
  password_hash?: string | null;
};

type AppAppointmentRow = {
  id: string;
  patient_id: string | null;
  title: string;
  status: string;
  start_at: string;
  end_at: string;
  google_event_id?: string | null;
  calendar_id?: string | null;
  clinic_id?: string | null;
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

type AppClinicRow = {
  id: string;
  owner_professional_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string | null;
  calendar_id: string | null;
};

type AppStaffMemberRow = {
  id: string;
  owner_professional_id: string;
  member_professional_id: string | null;
  clinic_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type AppStaffInvitationRow = {
  id: string;
  owner_professional_id: string;
  clinic_id: string | null;
  email: string | null;
  role: string;
  status: string;
  invited_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  token_hash: string;
};

type AppStaffInvitationWithOwnerRow = AppStaffInvitationRow & {
  owner:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        clinic_name: string | null;
        subscription_plan: string | null;
        subscription_status: string | null;
        trial_started_at: string | null;
        trial_ends_at: string | null;
        subscription_locked_at: string | null;
      }
    | null;
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
    timeZone: normalizeTimeZone(row.time_zone ?? null),
    logoPath: row.logo_path ?? null,
    logoUrl: null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapClinic(row: AppClinicRow): Clinic {
  return {
    id: row.id,
    ownerProfessionalId: row.owner_professional_id,
    name: row.name,
    address: row.address,
    calendarId: row.calendar_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffMember(
  row: AppStaffMemberRow,
  clinicLookup: Map<string, Clinic>,
): StaffMember {
  const clinic = row.clinic_id ? clinicLookup.get(row.clinic_id) ?? null : null;
  return {
    id: row.id,
    ownerProfessionalId: row.owner_professional_id,
    memberProfessionalId: row.member_professional_id,
    clinicId: row.clinic_id,
    clinicName: clinic?.name ?? null,
    fullName: row.full_name ?? 'Usuario invitado',
    email: row.email ?? '',
    role: (row.role as StaffRole) ?? 'assistant',
    status: (row.status as StaffStatus) ?? 'active',
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}

function mapStaffInvitation(
  row: AppStaffInvitationRow,
  clinicLookup: Map<string, Clinic>,
): StaffInvitation {
  const clinic = row.clinic_id ? clinicLookup.get(row.clinic_id) ?? null : null;
  return {
    id: row.id,
    ownerProfessionalId: row.owner_professional_id,
    clinicId: row.clinic_id,
    clinicName: clinic?.name ?? null,
    email: row.email ?? '',
    role: (row.role as StaffRole) ?? 'assistant',
    status: (row.status as StaffInvitationStatus) ?? 'pending',
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  };
}

type PatientSensitivePayload = {
  dni?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  healthInsurance?: string | null;
  affiliateNumber?: string | null;
};

async function mapPatient(record: AppPatientRow): Promise<Patient> {
  let decrypted: PatientSensitivePayload | null = null;

  if (
    record.professional_id &&
    record.contact_payload_ciphertext &&
    record.contact_payload_iv &&
    typeof record.contact_payload_version === 'number'
  ) {
    try {
      decrypted = await decryptSensitivePayload<PatientSensitivePayload>(record.professional_id, {
        ciphertext: record.contact_payload_ciphertext,
        iv: record.contact_payload_iv,
        version: record.contact_payload_version,
      });
    } catch (error) {
      console.error('No pudimos descifrar los datos del paciente', error);
    }
  }

  const name = (decrypted?.firstName ?? record.first_name ?? '').trim();
  const lastName = (decrypted?.lastName ?? record.last_name ?? '').trim();

  return {
    id: record.id,
    dni: decrypted?.dni ?? record.dni ?? '',
    name,
    lastName,
    email: decrypted?.email ?? record.email ?? '',
    phone: decrypted?.phone ?? record.phone ?? '',
    address: decrypted?.address ?? record.address ?? '',
    healthInsurance: decrypted?.healthInsurance ?? record.health_insurance ?? 'Particular',
    affiliateNumber: decrypted?.affiliateNumber ?? record.afiliado ?? undefined,
    status: (record.status as Patient['status']) ?? 'active',
    clinicId: record.clinic_id ?? null,
    clinicName: record.clinic_name ?? null,
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
    calendarId: record.calendar_id ?? null,
    clinicId: record.clinic_id ?? null,
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

export async function registerProfessional(
  data: {
    dni: string;
    name: string;
    email: string;
    password: string;
  },
  options?: {
    ownerProfessionalId?: string | null;
    subscriptionPlan?: SubscriptionPlan;
    subscriptionStatus?: SubscriptionStatus;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    subscriptionLockedAt?: string | null;
  },
): Promise<User> {
  const client = getClient();
  const { dni, name, email, password } = data;
  const ownerProfessionalId = options?.ownerProfessionalId ?? null;

  const { data: existing } = await client
    .from(PROFESSIONALS_TABLE)
    .select('id, dni')
    .or(`dni.eq.${dni},email.eq.${email}`)
    .maybeSingle();

  if (existing) {
    throw new Error('Ya existe un profesional con ese DNI o correo');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const trialStartedAt = options?.trialStartedAt ?? now.toISOString();
  const trialEndsAt = options?.trialEndsAt ??
    (ownerProfessionalId
      ? options?.trialEndsAt ?? null
      : new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString());
  const subscriptionPlan = normalizeSubscriptionPlan(options?.subscriptionPlan ?? null);
  const subscriptionStatus = options?.subscriptionStatus ?? 'trialing';
  const subscriptionLockedAt = options?.subscriptionLockedAt ?? null;

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
      time_zone: DEFAULT_TIME_ZONE,
      subscription_plan: subscriptionPlan,
      subscription_status: subscriptionStatus,
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      subscription_locked_at: subscriptionLockedAt,
      owner_professional_id: ownerProfessionalId,
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
    timeZone: (inserted as { time_zone?: string | null }).time_zone ?? DEFAULT_TIME_ZONE,
    subscriptionPlan,
    subscriptionStatus: ensureSubscriptionStatus(
      (inserted as { subscription_status?: SubscriptionStatus | null }).subscription_status ?? subscriptionStatus,
      (inserted as { trial_ends_at?: string | null }).trial_ends_at ?? trialEndsAt,
    ),
    trialStartedAt: (inserted as { trial_started_at?: string | null }).trial_started_at ?? trialStartedAt,
    trialEndsAt: (inserted as { trial_ends_at?: string | null }).trial_ends_at ?? trialEndsAt,
    subscriptionLockedAt:
      (inserted as { subscription_locked_at?: string | null }).subscription_locked_at ?? subscriptionLockedAt,
    ownerProfessionalId,
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
  timeZone: string | null;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionLockedAt: string | null;
  ownerProfessionalId: string | null;
  teamRole: StaffRole | null;
  teamClinicId: string | null;
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
    const ownerProfessionalId =
      (data as { owner_professional_id?: string | null }).owner_professional_id ?? null;
    let rawPlan = (data as { subscription_plan?: string | null }).subscription_plan ?? null;
    let rawStatus = (data as { subscription_status?: string | null }).subscription_status ?? null;
    let trialStartedAtRaw = (data as { trial_started_at?: string | null }).trial_started_at ?? null;
    let trialEndsAtRaw = (data as { trial_ends_at?: string | null }).trial_ends_at ?? null;
    let subscriptionLockedAt =
      (data as { subscription_locked_at?: string | null }).subscription_locked_at ?? null;
    let teamRole: StaffRole | null = null;
    let teamClinicId: string | null = null;

    if (ownerProfessionalId) {
      const { data: staffRow, error: staffError } = await client
        .from(STAFF_MEMBERS_TABLE)
        .select('*')
        .eq('member_professional_id', data.id)
        .maybeSingle<AppStaffMemberRow>();

      if (staffError) throw staffError;
      if (!staffRow) {
        throw new Error('La invitación no está asociada a un equipo válido.');
      }

      if (staffRow.status !== 'active') {
        throw new Error('Tu acceso al equipo no está activo. Consultá con el administrador.');
      }

      teamRole = (staffRow.role as StaffRole) ?? 'assistant';
      teamClinicId = staffRow.clinic_id ?? null;

      const { data: ownerRow, error: ownerError } = await client
        .from(PROFESSIONALS_TABLE)
        .select('*')
        .eq('id', ownerProfessionalId)
        .maybeSingle();

      if (ownerError) throw ownerError;
      if (ownerRow) {
        rawPlan = (ownerRow as { subscription_plan?: string | null }).subscription_plan ?? rawPlan;
        rawStatus = (ownerRow as { subscription_status?: string | null }).subscription_status ?? rawStatus;
        trialStartedAtRaw =
          (ownerRow as { trial_started_at?: string | null }).trial_started_at ?? trialStartedAtRaw;
        trialEndsAtRaw = (ownerRow as { trial_ends_at?: string | null }).trial_ends_at ?? trialEndsAtRaw;
        subscriptionLockedAt =
          (ownerRow as { subscription_locked_at?: string | null }).subscription_locked_at ??
          subscriptionLockedAt;
      }
    }

    const plan = normalizeSubscriptionPlan(rawPlan);
    const subscriptionStatus = ensureSubscriptionStatus(
      (rawStatus as SubscriptionStatus | null) ?? null,
      trialEndsAtRaw ?? null,
    );
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
      timeZone: normalizeTimeZone((data as { time_zone?: string | null }).time_zone ?? null),
      subscriptionPlan: plan,
      subscriptionStatus,
      trialStartedAt: trialStartedAtRaw,
      trialEndsAt: trialEndsAtRaw,
      subscriptionLockedAt,
      ownerProfessionalId,
      teamRole,
      teamClinicId,
    };
  }

  const dniHash = hashSensitiveValue(dni);
  let row: AppPatientRow | null = null;

  if (dniHash) {
    const { data: hashedData, error: hashedError } = await client
      .from(PATIENTS_TABLE)
      .select('*')
      .eq('dni_hash', dniHash)
      .maybeSingle<AppPatientRow>();

    if (hashedError) throw hashedError;
    if (hashedData) {
      row = hashedData;
    }
  }

  if (!row) {
    const { data: legacyData, error: legacyError } = await client
      .from(PATIENTS_TABLE)
      .select('*')
      .eq('dni', dni)
      .maybeSingle<AppPatientRow>();

    if (legacyError) throw legacyError;
    row = legacyData ?? null;
  }

  if (!row) return null;
  const patient = await mapPatient(row);
  return {
    id: patient.id,
    dni: patient.dni,
    name: `${patient.name} ${patient.lastName}`.trim(),
    email: patient.email ?? '',
    type: 'paciente' as const,
    passwordHash: row.password_hash ?? null,
    clinicName: null,
    licenseNumber: null,
    phone: patient.phone ?? null,
    address: patient.address ?? null,
    country: null,
    province: null,
    locality: null,
    timeZone: null,
    subscriptionPlan: null,
    subscriptionStatus: null,
    trialStartedAt: null,
    trialEndsAt: null,
    subscriptionLockedAt: null,
    ownerProfessionalId: row.professional_id ?? null,
    teamRole: null,
    teamClinicId: null,
  };
}

export async function getProfessionalSubscriptionSummary(
  professionalId: string,
): Promise<{
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionLockedAt: string | null;
}> {
  const client = getClient();
  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .select(
      'subscription_plan, subscription_status, trial_started_at, trial_ends_at, subscription_locked_at',
    )
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw error;

  const rawPlan = (data as { subscription_plan?: string | null } | null)?.subscription_plan ?? null;
  const plan = normalizeSubscriptionPlan(rawPlan);
  const trialStartedAt =
    (data as { trial_started_at?: string | null } | null)?.trial_started_at ?? null;
  const trialEndsAt = (data as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null;
  const rawStatus = (data as { subscription_status?: string | null } | null)?.subscription_status ?? null;
  const status = ensureSubscriptionStatus((rawStatus as SubscriptionStatus | null) ?? null, trialEndsAt);
  const subscriptionLockedAt =
    (data as { subscription_locked_at?: string | null } | null)?.subscription_locked_at ?? null;

  return { plan, status, trialStartedAt, trialEndsAt, subscriptionLockedAt };
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
  timeZone?: string | null;
};

export async function getProfessionalProfile(professionalId: string): Promise<ProfessionalProfile | null> {
  const client = getClient();

  const { data, error } = await client
    .from(PROFESSIONALS_TABLE)
    .select(
      'id, dni, full_name, email, clinic_name, license_number, phone, address, country, province, locality, time_zone, logo_path, updated_at',
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

  const timeZone = updates.timeZone === undefined ? undefined : normalizeTimeZone(updates.timeZone);
  if (timeZone !== undefined) {
    payload.time_zone = timeZone;
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
      'id, dni, full_name, email, clinic_name, license_number, phone, address, country, province, locality, time_zone, logo_path, updated_at',
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
  filters: { search?: string; status?: string; clinicId?: string } = {},
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

  if (filters.clinicId) {
    query = query.eq('clinic_id', filters.clinicId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AppPatientRow[];
  let patients = await Promise.all(rows.map((row) => mapPatient(row)));

  if (filters.search) {
    const search = filters.search.trim().toLowerCase();
    if (search.length > 0) {
      patients = patients.filter((patient) => {
        const haystack = [
          patient.name,
          patient.lastName,
          `${patient.name} ${patient.lastName}`.trim(),
          patient.dni,
          patient.email,
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());
        return haystack.some((value) => value.includes(search));
      });
    }
  }

  return patients;
}

export async function createPatient(
  professionalId: string,
  patient: Omit<Patient, 'id'>,
): Promise<Patient> {
  const client = getClient();
  const dniHash = hashSensitiveValue(patient.dni);
  const encrypted = await encryptSensitivePayload(professionalId, {
    dni: patient.dni,
    firstName: patient.name,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phone,
    address: patient.address,
    healthInsurance: patient.healthInsurance,
    affiliateNumber: patient.affiliateNumber ?? null,
  });

  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .insert({
      professional_id: professionalId,
      dni: maskIfPresent(patient.dni),
      dni_hash: dniHash,
      first_name: ENCRYPTED_PLACEHOLDER,
      last_name: ENCRYPTED_PLACEHOLDER,
      email: maskIfPresent(patient.email),
      phone: maskIfPresent(patient.phone),
      address: maskIfPresent(patient.address),
      health_insurance: maskIfPresent(patient.healthInsurance),
      afiliado: maskIfPresent(patient.affiliateNumber ?? null),
      status: patient.status,
      clinic_id: patient.clinicId ?? null,
      clinic_name: patient.clinicName ?? null,
      contact_payload_ciphertext: encrypted.ciphertext,
      contact_payload_iv: encrypted.iv,
      contact_payload_version: encrypted.version,
    })
    .select('*')
    .single();
  if (error) throw error;
  return await mapPatient(data as AppPatientRow);
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
  return data ? await mapPatient(data as AppPatientRow) : null;
}

export async function updatePatient(
  professionalId: string,
  patientId: string,
  updates: Partial<Patient>,
): Promise<Patient | null> {
  const client = getClient();
  const { data: existingData, error: existingError } = await client
    .from(PATIENTS_TABLE)
    .select('*')
    .eq('id', patientId)
    .eq('professional_id', professionalId)
    .maybeSingle<AppPatientRow>();

  if (existingError) {
    throw existingError;
  }

  if (!existingData) {
    return null;
  }

  const current = await mapPatient(existingData);
  const nextDni = updates.dni ?? current.dni ?? '';
  const dniHash = hashSensitiveValue(nextDni);
  const nextEmail = updates.email ?? current.email ?? '';
  const nextPhone = updates.phone ?? current.phone ?? '';
  const nextAddress = updates.address ?? current.address ?? '';
  const nextHealthInsurance = updates.healthInsurance ?? current.healthInsurance ?? '';
  const nextAffiliate = updates.affiliateNumber ?? current.affiliateNumber ?? null;
  const clinicIdUpdateProvided = Object.prototype.hasOwnProperty.call(updates, 'clinicId');
  const clinicNameUpdateProvided = Object.prototype.hasOwnProperty.call(updates, 'clinicName');

  const encrypted = await encryptSensitivePayload(professionalId, {
    dni: nextDni,
    firstName: updates.name ?? current.name,
    lastName: updates.lastName ?? current.lastName,
    email: nextEmail,
    phone: nextPhone,
    address: nextAddress,
    healthInsurance: nextHealthInsurance,
    affiliateNumber: nextAffiliate,
  });

  const { data, error } = await client
    .from(PATIENTS_TABLE)
    .update({
      dni: maskIfPresent(nextDni),
      dni_hash: dniHash,
      first_name: ENCRYPTED_PLACEHOLDER,
      last_name: ENCRYPTED_PLACEHOLDER,
      email: maskIfPresent(nextEmail),
      phone: maskIfPresent(nextPhone),
      address: maskIfPresent(nextAddress),
      health_insurance: maskIfPresent(nextHealthInsurance),
      afiliado: maskIfPresent(nextAffiliate ?? null),
      status: updates.status ?? current.status,
      ...(clinicIdUpdateProvided
        ? { clinic_id: updates.clinicId ?? null }
        : {}),
      ...(clinicNameUpdateProvided
        ? { clinic_name: updates.clinicName ?? null }
        : {}),
      contact_payload_ciphertext: encrypted.ciphertext,
      contact_payload_iv: encrypted.iv,
      contact_payload_version: encrypted.version,
    })
    .eq('id', patientId)
    .eq('professional_id', professionalId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? await mapPatient(data as AppPatientRow) : null;
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

export async function listClinicsAndTeam(
  professionalId: string,
): Promise<{
  clinics: Clinic[];
  staff: StaffMember[];
  invitations: StaffInvitation[];
}> {
  const client = getClient();

  const { data: clinicRows, error: clinicError } = await client
    .from(CLINICS_TABLE)
    .select('*')
    .eq('owner_professional_id', professionalId)
    .order('name', { ascending: true });

  if (clinicError) throw clinicError;

  const clinics = (clinicRows ?? []).map((row) => mapClinic(row as AppClinicRow));
  const clinicLookup = new Map(clinics.map((clinic) => [clinic.id, clinic] as const));

  const { data: staffRows, error: staffError } = await client
    .from(STAFF_MEMBERS_TABLE)
    .select('*')
    .eq('owner_professional_id', professionalId)
    .order('full_name', { ascending: true });

  if (staffError) throw staffError;

  const staff = (staffRows ?? []).map((row) =>
    mapStaffMember(row as AppStaffMemberRow, clinicLookup),
  );

  const { data: invitationRows, error: invitationError } = await client
    .from(STAFF_INVITATIONS_TABLE)
    .select('*')
    .eq('owner_professional_id', professionalId)
    .order('invited_at', { ascending: false });

  if (invitationError) throw invitationError;

  const invitations = (invitationRows ?? []).map((row) =>
    mapStaffInvitation(row as AppStaffInvitationRow, clinicLookup),
  );

  return { clinics, staff, invitations };
}

export async function getStaffMemberById(
  ownerProfessionalId: string,
  staffId: string,
): Promise<StaffMember | null> {
  const client = getClient();

  const { data, error } = await client
    .from(STAFF_MEMBERS_TABLE)
    .select('*')
    .eq('owner_professional_id', ownerProfessionalId)
    .eq('id', staffId)
    .maybeSingle<AppStaffMemberRow>();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const clinicLookup = new Map<string, Clinic>();

  if (data.clinic_id) {
    const { data: clinicRow } = await client
      .from(CLINICS_TABLE)
      .select('*')
      .eq('id', data.clinic_id)
      .maybeSingle<AppClinicRow>();

    if (clinicRow) {
      clinicLookup.set(clinicRow.id, mapClinic(clinicRow as AppClinicRow));
    }
  }

  return mapStaffMember(data, clinicLookup);
}

export async function getStaffInvitationById(
  ownerProfessionalId: string,
  invitationId: string,
): Promise<StaffInvitation | null> {
  const client = getClient();

  const { data, error } = await client
    .from(STAFF_INVITATIONS_TABLE)
    .select('*')
    .eq('owner_professional_id', ownerProfessionalId)
    .eq('id', invitationId)
    .maybeSingle<AppStaffInvitationRow>();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const clinicLookup = new Map<string, Clinic>();

  if (data.clinic_id) {
    const { data: clinicRow } = await client
      .from(CLINICS_TABLE)
      .select('*')
      .eq('id', data.clinic_id)
      .maybeSingle<AppClinicRow>();

    if (clinicRow) {
      clinicLookup.set(clinicRow.id, mapClinic(clinicRow as AppClinicRow));
    }
  }

  return mapStaffInvitation(data, clinicLookup);
}

export async function getClinicCountForProfessional(professionalId: string): Promise<number> {
  const client = getClient();
  const { count, error } = await client
    .from(CLINICS_TABLE)
    .select('id', { head: true, count: 'exact' })
    .eq('owner_professional_id', professionalId);

  if (error) throw error;

  return count ?? 0;
}

export async function createClinic(
  professionalId: string,
  clinic: { name: string; address?: string | null; calendarId?: string | null },
): Promise<Clinic> {
  const client = getClient();
  const payload = {
    owner_professional_id: professionalId,
    name: clinic.name,
    address: clinic.address ?? null,
    calendar_id: clinic.calendarId ?? null,
  };

  const { data, error } = await client
    .from(CLINICS_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  return mapClinic(data as AppClinicRow);
}

export async function updateClinic(
  professionalId: string,
  clinicId: string,
  clinic: { name?: string; address?: string | null; calendarId?: string | null },
): Promise<Clinic> {
  const client = getClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof clinic.name === 'string') {
    updates.name = clinic.name;
  }
  if (clinic.address !== undefined) {
    updates.address = clinic.address ?? null;
  }
  if (clinic.calendarId !== undefined) {
    updates.calendar_id = clinic.calendarId ?? null;
  }

  const { data, error } = await client
    .from(CLINICS_TABLE)
    .update(updates)
    .eq('id', clinicId)
    .eq('owner_professional_id', professionalId)
    .select('*')
    .single();

  if (error) throw error;

  return mapClinic(data as AppClinicRow);
}

export async function removeClinic(professionalId: string, clinicId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(CLINICS_TABLE)
    .delete()
    .eq('id', clinicId)
    .eq('owner_professional_id', professionalId);

  if (error) throw error;
}

export async function getClinicByIdForOwner(
  ownerProfessionalId: string,
  clinicId: string,
): Promise<Clinic | null> {
  const client = getClient();
  const { data, error } = await client
    .from(CLINICS_TABLE)
    .select('*')
    .eq('owner_professional_id', ownerProfessionalId)
    .eq('id', clinicId)
    .maybeSingle<AppClinicRow>();

  if (error) throw error;
  return data ? mapClinic(data as AppClinicRow) : null;
}

export async function listClinicsForProfessional(ownerProfessionalId: string): Promise<Clinic[]> {
  const client = getClient();
  const { data, error } = await client
    .from(CLINICS_TABLE)
    .select('*')
    .eq('owner_professional_id', ownerProfessionalId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as AppClinicRow[];
  return rows.map(mapClinic);
}

export async function createStaffInvitation(
  professionalId: string,
  invitation: {
    email: string;
    role: StaffRole;
    clinicId?: string | null;
    expiresAt?: Date | null;
  },
): Promise<{ invitation: StaffInvitation; token: string }> {
  const client = getClient();
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const insertPayload = {
    owner_professional_id: professionalId,
    clinic_id: invitation.clinicId ?? null,
    email: invitation.email,
    role: invitation.role,
    status: 'pending' satisfies StaffInvitationStatus,
    invited_at: new Date().toISOString(),
    expires_at: invitation.expiresAt ? invitation.expiresAt.toISOString() : null,
    token_hash: tokenHash,
  };

  const { data, error } = await client
    .from(STAFF_INVITATIONS_TABLE)
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;

  const clinicLookup = new Map<string, Clinic>();

  if (invitation.clinicId) {
    const { data: clinicRow } = await client
      .from(CLINICS_TABLE)
      .select('*')
      .eq('id', invitation.clinicId)
      .eq('owner_professional_id', professionalId)
      .maybeSingle();

    if (clinicRow) {
      const clinic = mapClinic(clinicRow as AppClinicRow);
      clinicLookup.set(clinic.id, clinic);
    }
  }

  return {
    invitation: mapStaffInvitation(data as AppStaffInvitationRow, clinicLookup),
    token,
  };
}

export async function getStaffInvitationDetails(
  token: string,
): Promise<
  | {
      invitation: StaffInvitation;
      owner: {
        id: string;
        name: string | null;
        email: string | null;
        clinicName: string | null;
        subscriptionPlan: SubscriptionPlan;
        subscriptionStatus: SubscriptionStatus;
        trialStartedAt: string | null;
        trialEndsAt: string | null;
        subscriptionLockedAt: string | null;
      };
    }
  | null
> {
  const client = getClient();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data, error } = await client
    .from(STAFF_INVITATIONS_TABLE)
    .select(
      '*,' +
        'owner:owner_professional_id(' +
        'id, full_name, email, clinic_name, subscription_plan, subscription_status, trial_started_at, trial_ends_at, subscription_locked_at' +
        ')',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle<AppStaffInvitationWithOwnerRow>();

  if (error) throw error;
  if (!data) {
    return null;
  }

  const status = (data.status as StaffInvitationStatus | undefined) ?? 'pending';
  if (status !== 'pending') {
    return null;
  }

  const expiresAtRaw = data.expires_at ?? null;
  if (expiresAtRaw) {
    const expiresAtDate = new Date(expiresAtRaw);
    if (!Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() < Date.now()) {
      await client
        .from(STAFF_INVITATIONS_TABLE)
        .update({ status: 'expired' satisfies StaffInvitationStatus })
        .eq('id', data.id);
      return null;
    }
  }

  const clinicLookup = new Map<string, Clinic>();
  if (data.clinic_id) {
    const { data: clinicRow } = await client
      .from(CLINICS_TABLE)
      .select('*')
      .eq('id', data.clinic_id)
      .maybeSingle<AppClinicRow>();

    if (clinicRow) {
      clinicLookup.set(clinicRow.id, mapClinic(clinicRow as AppClinicRow));
    }
  }

  const invitation = mapStaffInvitation(data, clinicLookup);
  const ownerRow = data.owner;

  if (!ownerRow) {
    throw new Error('La invitación no tiene un propietario válido.');
  }

  const rawPlan = ownerRow.subscription_plan ?? null;
  const plan = normalizeSubscriptionPlan(rawPlan);
  const trialStartedAt = ownerRow.trial_started_at ?? null;
  const trialEndsAt = ownerRow.trial_ends_at ?? null;
  const rawStatus = ownerRow.subscription_status ?? null;
  const subscriptionStatus = ensureSubscriptionStatus(
    (rawStatus as SubscriptionStatus | null) ?? null,
    trialEndsAt,
  );

  return {
    invitation,
    owner: {
      id: ownerRow.id,
      name: ownerRow.full_name ?? null,
      email: ownerRow.email ?? null,
      clinicName: ownerRow.clinic_name ?? null,
      subscriptionPlan: plan,
      subscriptionStatus,
      trialStartedAt,
      trialEndsAt,
      subscriptionLockedAt: ownerRow.subscription_locked_at ?? null,
    },
  };
}

export async function acceptStaffInvitation({
  token,
  dni,
  name,
  password,
}: {
  token: string;
  dni: string;
  name: string;
  password: string;
}): Promise<{ user: User; staff: StaffMember; ownerId: string }>
{
  const details = await getStaffInvitationDetails(token);

  if (!details) {
    throw new Error('La invitación no es válida o ya fue utilizada.');
  }

  const { invitation, owner } = details;

  if (!invitation.email) {
    throw new Error('La invitación no especifica un correo electrónico.');
  }

  const client = getClient();

  const ownerSummary = await getProfessionalSubscriptionSummary(owner.id);

  const user = await registerProfessional(
    {
      dni,
      name,
      email: invitation.email,
      password,
    },
    {
      ownerProfessionalId: owner.id,
      subscriptionPlan: ownerSummary.plan,
      subscriptionStatus: ownerSummary.status,
      trialStartedAt: ownerSummary.trialStartedAt,
      trialEndsAt: ownerSummary.trialEndsAt,
      subscriptionLockedAt: ownerSummary.subscriptionLockedAt,
    },
  );

  const acceptedAt = new Date().toISOString();

  const { data: staffRow, error: staffError } = await client
    .from(STAFF_MEMBERS_TABLE)
    .upsert(
      {
        owner_professional_id: owner.id,
        member_professional_id: user.id,
        clinic_id: invitation.clinicId ?? null,
        email: invitation.email,
        full_name: name,
        role: invitation.role,
        status: 'active' satisfies StaffStatus,
        invited_at: invitation.invitedAt ?? acceptedAt,
        accepted_at: acceptedAt,
      },
      { onConflict: 'owner_professional_id,email' },
    )
    .select('*')
    .single<AppStaffMemberRow>();

  if (staffError) throw staffError;

  await client
    .from(STAFF_INVITATIONS_TABLE)
    .update({ status: 'accepted' satisfies StaffInvitationStatus, accepted_at: acceptedAt })
    .eq('id', invitation.id);

  const clinicLookup = new Map<string, Clinic>();
  if (staffRow.clinic_id) {
    const { data: clinicRow } = await client
      .from(CLINICS_TABLE)
      .select('*')
      .eq('id', staffRow.clinic_id)
      .maybeSingle<AppClinicRow>();

    if (clinicRow) {
      clinicLookup.set(clinicRow.id, mapClinic(clinicRow as AppClinicRow));
    }
  }

  const staff = mapStaffMember(staffRow, clinicLookup);

  return { user, staff, ownerId: owner.id };
}

export async function revokeStaffInvitation(
  professionalId: string,
  invitationId: string,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(STAFF_INVITATIONS_TABLE)
    .update({ status: 'revoked' satisfies StaffInvitationStatus })
    .eq('id', invitationId)
    .eq('owner_professional_id', professionalId);

  if (error) throw error;
}

export async function removeStaffMember(
  professionalId: string,
  staffId: string,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from(STAFF_MEMBERS_TABLE)
    .delete()
    .eq('id', staffId)
    .eq('owner_professional_id', professionalId);

  if (error) throw error;
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
    calendarId?: string | null;
    clinicId?: string | null;
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
      calendar_id: appointment.calendarId ?? null,
      clinic_id: appointment.clinicId ?? null,
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
  calendarId?: string | null,
) {
  const client = getClient();
  const updates: Record<string, unknown> = { google_event_id: googleEventId };
  if (calendarId !== undefined) {
    updates.calendar_id = calendarId ?? null;
  }
  const { data, error } = await client
    .from(APPOINTMENTS_TABLE)
    .update(updates)
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
  options: { timeZone?: string } = {},
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

  if (updates.calendarId !== undefined) {
    payload.calendar_id = updates.calendarId ?? null;
  }

  if (updates.clinicId !== undefined) {
    payload.clinic_id = updates.clinicId ?? null;
  }

  if (updates.date || updates.time) {
    const timeZone = normalizeTimeZone(options.timeZone);
    const currentLocal = formatDateTimeInTimeZone(current.start_at, timeZone);
    const targetDate = updates.date ?? currentLocal.date;
    const targetTime = updates.time ?? currentLocal.time;
    const startDate = parseDateTimeInTimeZone(targetDate, targetTime, timeZone);
    const endDate = new Date(current.end_at);
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
  timeZone?: string | null;
  logoUrl?: string | null;
  subscriptionPlan?: SubscriptionPlan | null;
  subscriptionStatus?: SubscriptionStatus | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  subscriptionLockedAt?: string | null;
  ownerProfessionalId?: string | null;
  teamRole?: StaffRole | null;
  teamClinicId?: string | null;
}): User {
  const resolvedPlan =
    user.subscriptionPlan ?? (user.type === 'profesional' ? 'starter' : null);
  const resolvedStatus = ensureSubscriptionStatus(
    user.subscriptionStatus ?? null,
    user.trialEndsAt ?? null,
  );
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
    timeZone: user.timeZone ?? null,
    logoUrl: user.logoUrl ?? null,
    subscriptionPlan: resolvedPlan,
    subscriptionStatus: resolvedStatus,
    trialStartedAt: user.trialStartedAt ?? null,
    trialEndsAt: user.trialEndsAt ?? null,
    subscriptionLockedAt: user.subscriptionLockedAt ?? null,
    ownerProfessionalId: user.ownerProfessionalId ?? null,
    teamRole: user.teamRole ?? null,
    teamClinicId: user.teamClinicId ?? null,
  };
}
