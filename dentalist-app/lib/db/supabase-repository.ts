import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import {
  Appointment,
  ClinicalHistory,
  ClinicalHistoryInput,
  ClinicalStage,
  Patient,
  Payment,
  Prescription,
  Treatment,
  User,
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
const DOCUMENTS_BUCKET =
  process.env.SUPABASE_BUCKET_CLINICAL_DOCUMENTS ?? 'clinical-documents';
const SIGNATURES_BUCKET =
  process.env.SUPABASE_BUCKET_PROFESSIONAL_SIGNATURES ??
  'professional-signatures';

const CLINICAL_STAGES: ClinicalStage[] = ['baseline', 'initial', 'intermediate', 'final'];

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

async function createSignedUrl(
  client: ReturnType<typeof getClient>,
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error('No pudimos generar una URL firmada de Supabase', error);
    return null;
  }

  return data?.signedUrl ?? null;
}

type AppPatientRow = {
  id: string;
  dni: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  obra_social: string | null;
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

function mapPatient(record: AppPatientRow): Patient {
  return {
    id: record.id,
    dni: record.dni ?? '',
    name: record.first_name,
    lastName: record.last_name,
    email: record.email ?? '',
    phone: record.phone ?? '',
    address: record.address ?? '',
    healthInsurance: record.obra_social ?? 'Particular',
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

  return {
    id: row.id,
    patientId: row.patient_id,
    summary: row.summary,
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
  };
}

export type StoredAuthUser = {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: User['type'];
  passwordHash: string | null;
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
      obra_social: patient.healthInsurance,
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
      obra_social: updates.healthInsurance,
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
      start_date: treatment.date,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapTreatment(data as AppTreatmentRow);
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
      .update({ summary: input.summary ?? null })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    historyId = existing.id;
  } else {
    const { data: created, error: insertError } = await client
      .from(CLINICAL_HISTORIES_TABLE)
      .insert({
        professional_id: professionalId,
        patient_id: patientId,
        summary: input.summary ?? null,
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
}): User {
  return user;
}
