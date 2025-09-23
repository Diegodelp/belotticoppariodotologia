import bcrypt from 'bcryptjs';
import { Appointment, Patient, Payment, Treatment, User } from '@/types';

interface StoredUser extends User {
  passwordHash: string;
  createdAt: string;
}

interface TwoFactorEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

interface DentalistDatabase {
  users: StoredUser[];
  patients: Patient[];
  appointments: Appointment[];
  treatments: Treatment[];
  payments: Payment[];
  twoFactorCodes: Record<string, TwoFactorEntry>;
}

function createInitialPatients(): Patient[] {
  return [
    {
      id: crypto.randomUUID(),
      dni: '28333444',
      name: 'María',
      lastName: 'González',
      email: 'maria.gonzalez@example.com',
      phone: '+54 9 11 4567-8910',
      address: 'Av. Corrientes 1234, CABA',
      healthInsurance: 'OSDE 310',
      affiliateNumber: '12345678/90',
      status: 'active',
    },
    {
      id: crypto.randomUUID(),
      dni: '30555111',
      name: 'Pedro',
      lastName: 'Martínez',
      email: 'pedro.martinez@example.com',
      phone: '+54 9 221 678-9012',
      address: 'Calle 12 456, La Plata',
      healthInsurance: 'Swiss Medical SMG 30',
      affiliateNumber: '99887766/55',
      status: 'active',
    },
    {
      id: crypto.randomUUID(),
      dni: '32777123',
      name: 'Lucía',
      lastName: 'Rossi',
      email: 'lucia.rossi@example.com',
      phone: '+54 9 261 555-7788',
      address: 'San Martín 987, Mendoza',
      healthInsurance: 'Galeno 360',
      affiliateNumber: undefined,
      status: 'inactive',
    },
  ];
}

function createInitialAppointments(patients: Patient[]): Appointment[] {
  const [maria, pedro, lucia] = patients;
  const today = new Date();

  const toIso = (date: Date) => date.toISOString().split('T')[0];
  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);
  inTwoDays.setHours(15, 30, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);

  return [
    {
      id: crypto.randomUUID(),
      patientId: maria.id,
      date: toIso(tomorrow),
      time: formatTime(tomorrow),
      type: 'Control de ortodoncia',
      status: 'confirmed',
    },
    {
      id: crypto.randomUUID(),
      patientId: pedro.id,
      date: toIso(inTwoDays),
      time: formatTime(inTwoDays),
      type: 'Limpieza y profilaxis',
      status: 'pending',
    },
    {
      id: crypto.randomUUID(),
      patientId: lucia.id,
      date: toIso(nextWeek),
      time: formatTime(nextWeek),
      type: 'Implante dental - seguimiento',
      status: 'confirmed',
    },
  ];
}

function createInitialTreatments(patients: Patient[]): Treatment[] {
  return [
    {
      id: crypto.randomUUID(),
      patientId: patients[0].id,
      type: 'Ortodoncia',
      description: 'Ajuste mensual de brackets metálicos',
      cost: 55000,
      date: new Date().toISOString().split('T')[0],
    },
    {
      id: crypto.randomUUID(),
      patientId: patients[1].id,
      type: 'Limpieza',
      description: 'Limpieza profunda y fluorización',
      cost: 30000,
      date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
    },
    {
      id: crypto.randomUUID(),
      patientId: patients[2].id,
      type: 'Implante',
      description: 'Colocación de implante dental en pieza 2.6',
      cost: 180000,
      date: new Date(Date.now() - 86400000 * 25).toISOString().split('T')[0],
    },
  ];
}

function createInitialPayments(patients: Patient[]): Payment[] {
  return [
    {
      id: crypto.randomUUID(),
      patientId: patients[0].id,
      amount: 55000,
      method: 'card',
      status: 'completed',
      date: new Date().toISOString(),
      notes: 'Cobro con tarjeta de crédito, 3 cuotas sin interés',
    },
    {
      id: crypto.randomUUID(),
      patientId: patients[1].id,
      amount: 30000,
      method: 'cash',
      status: 'completed',
      date: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      patientId: patients[2].id,
      amount: 90000,
      method: 'transfer',
      status: 'pending',
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      notes: 'Señal de reserva a confirmar por transferencia bancaria',
    },
  ];
}

function createInitialUsers(patients: Patient[]): StoredUser[] {
  const professionalPassword = bcrypt.hashSync('dentalist123', 10);
  const patientPassword = bcrypt.hashSync('paciente123', 10);

  return [
    {
      id: crypto.randomUUID(),
      dni: '20123123',
      name: 'Dra. Sofía Belotti',
      email: 'sofia.belotti@dentalist.com',
      type: 'profesional',
      passwordHash: professionalPassword,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      dni: patients[0].dni,
      name: `${patients[0].name} ${patients[0].lastName}`,
      email: patients[0].email,
      type: 'paciente',
      passwordHash: patientPassword,
      createdAt: new Date().toISOString(),
    },
  ];
}

function createInitialDatabase(): DentalistDatabase {
  const patients = createInitialPatients();
  return {
    users: createInitialUsers(patients),
    patients,
    appointments: createInitialAppointments(patients),
    treatments: createInitialTreatments(patients),
    payments: createInitialPayments(patients),
    twoFactorCodes: {},
  };
}

const globalForDentalist = globalThis as typeof globalThis & {
  dentalistDb?: DentalistDatabase;
};

export const dentalistDb =
  globalForDentalist.dentalistDb ??= createInitialDatabase();

export function findUserByDni(dni: string, type: User['type']) {
  return dentalistDb.users.find(
    (user) => user.dni === dni && user.type === type,
  );
}

export function addUser(user: StoredUser) {
  dentalistDb.users.push(user);
}

export function storeTwoFactorCode(
  userId: string,
  code: string,
  ttlMinutes = 5,
) {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  dentalistDb.twoFactorCodes[userId] = { code, expiresAt, attempts: 0 };
}

export function validateTwoFactorCode(userId: string, code: string) {
  const entry = dentalistDb.twoFactorCodes[userId];
  if (!entry) {
    return { valid: false, reason: 'Código no solicitado' } as const;
  }

  if (Date.now() > entry.expiresAt) {
    delete dentalistDb.twoFactorCodes[userId];
    return { valid: false, reason: 'Código expirado' } as const;
  }

  if (entry.attempts >= 5) {
    delete dentalistDb.twoFactorCodes[userId];
    return { valid: false, reason: 'Se superó el número de intentos permitidos' } as const;
  }

  entry.attempts += 1;

  if (entry.code !== code) {
    return { valid: false, reason: 'Código incorrecto' } as const;
  }

  delete dentalistDb.twoFactorCodes[userId];
  return { valid: true } as const;
}

export function getPatients() {
  return dentalistDb.patients;
}

export function addPatient(patient: Patient) {
  dentalistDb.patients.push(patient);
}

export function updatePatient(id: string, data: Partial<Patient>) {
  const index = dentalistDb.patients.findIndex((patient) => patient.id === id);
  if (index === -1) return null;
  dentalistDb.patients[index] = {
    ...dentalistDb.patients[index],
    ...data,
  };
  return dentalistDb.patients[index];
}

export function removePatient(id: string) {
  const index = dentalistDb.patients.findIndex((patient) => patient.id === id);
  if (index === -1) return false;
  dentalistDb.patients.splice(index, 1);
  dentalistDb.appointments = dentalistDb.appointments.filter(
    (appointment) => appointment.patientId !== id,
  );
  dentalistDb.treatments = dentalistDb.treatments.filter(
    (treatment) => treatment.patientId !== id,
  );
  dentalistDb.payments = dentalistDb.payments.filter(
    (payment) => payment.patientId !== id,
  );
  return true;
}

export function getAppointments(patientId?: string) {
  if (patientId) {
    return dentalistDb.appointments.filter(
      (appointment) => appointment.patientId === patientId,
    );
  }
  return dentalistDb.appointments;
}

export function addAppointment(appointment: Appointment) {
  dentalistDb.appointments.push(appointment);
}

export function getTreatments(patientId?: string) {
  if (patientId) {
    return dentalistDb.treatments.filter(
      (treatment) => treatment.patientId === patientId,
    );
  }
  return dentalistDb.treatments;
}

export function addTreatment(treatment: Treatment) {
  dentalistDb.treatments.push(treatment);
}

export function getPayments(patientId?: string) {
  if (patientId) {
    return dentalistDb.payments.filter(
      (payment) => payment.patientId === patientId,
    );
  }
  return dentalistDb.payments;
}

export function addPayment(payment: Payment) {
  dentalistDb.payments.push(payment);
}

export function toPublicUser(user: StoredUser): User {
  const { passwordHash, createdAt, ...rest } = user;
  void passwordHash;
  void createdAt;
  return rest;
}
