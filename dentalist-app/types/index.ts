export interface User {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: 'profesional' | 'paciente';
}

export interface Patient {
  id: string;
  dni: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  healthInsurance: string;
  affiliateNumber?: string;
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  type: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  startAt?: string;
  endAt?: string;
  googleEventId?: string;
}

export interface Treatment {
  id: string;
  patientId: string;
  type: string;
  description: string;
  cost: number;
  date: string;
}

export interface Payment {
  id: string;
  patientId: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer' | 'other';
  status: 'pending' | 'completed';
  date: string;
  notes?: string;
}

export type ClinicalStage = 'baseline' | 'initial' | 'intermediate' | 'final';

export interface CephalometricValues {
  biotipo?: string;
  patronEsqueletal?: string;
  sna?: string;
  snb?: string;
  anb?: string;
  naMm?: string;
  naAngle?: string;
  nbMm?: string;
  nbAngle?: string;
  planoMandibular?: string;
}

export interface ClinicalHistoryStage extends CephalometricValues {
  stage: ClinicalStage;
  recordedAt?: string;
}

export interface ClinicalHistory {
  id: string;
  patientId: string;
  summary: string | null;
  stages: Partial<Record<ClinicalStage, ClinicalHistoryStage>>;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalHistoryInput {
  summary?: string;
  stages: Partial<Record<ClinicalStage, CephalometricValues>>;
}

export type CephalometricField = keyof CephalometricValues;

export interface Prescription {
  id: string;
  patientId: string;
  title: string;
  diagnosis?: string | null;
  medication: string;
  instructions: string;
  notes?: string | null;
  pdfUrl: string;
  signaturePath?: string | null;
  createdAt: string;
}

export interface CreatePrescriptionInput {
  title: string;
  diagnosis?: string;
  medication: string;
  instructions: string;
  notes?: string;
  signatureDataUrl?: string | null;
  useStoredSignature?: boolean;
  saveSignature?: boolean;
}
