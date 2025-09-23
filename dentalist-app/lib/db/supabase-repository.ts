import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { Appointment, Patient, Payment, Treatment, User } from '@/types';

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

type AppPatientRow = {
  id: string;
  dni: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  password_hash: string | null;
  phone: string | null;
  address: string | null;
  health_insurance: string | null;
  status: string;
};

type AppAppointmentRow = {
  id: string;
  patient_id: string | null;
  title: string;
  status: string;
  start_at: string;
  end_at: string;
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
      health_insurance: patient.healthInsurance,
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
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
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

export function toPublicUser(user: {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: User['type'];
}): User {
  return user;
}
