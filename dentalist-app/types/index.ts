export interface User {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: 'profesional' | 'paciente';
  clinicName?: string | null;
  licenseNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  province?: string | null;
  locality?: string | null;
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

export interface MedicalBackground {
  personalHistory?: string;
  systemicConditions?: string;
  medications?: string;
  surgicalHistory?: string;
  notes?: string;
}

export interface FamilyHistory {
  father?: string;
  mother?: string;
  siblings?: string;
  others?: string;
}

export type OdontogramCondition = 'caries' | 'extraction' | 'sealant' | 'crown' | 'endodontic';

export type OdontogramMarkStatus = 'planned' | 'completed';

export type OdontogramSurface =
  | 'mesial'
  | 'distal'
  | 'occlusal'
  | 'vestibular'
  | 'lingual'
  | 'whole'
  | 'crown';

export interface OdontogramSurfaceMark {
  condition: OdontogramCondition;
  status: OdontogramMarkStatus;
}

export type OdontogramToothState = Partial<Record<OdontogramSurface, OdontogramSurfaceMark>>;

export type Odontogram = Record<string, OdontogramToothState>;

export interface ClinicalHistory {
  id: string;
  patientId: string;
  summary: string | null;
  reasonForConsultation: string | null;
  medicalBackground: MedicalBackground | null;
  familyHistory: FamilyHistory | null;
  allergies: string | null;
  odontogram: Odontogram | null;
  stages: Partial<Record<ClinicalStage, ClinicalHistoryStage>>;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalHistoryInput {
  summary?: string;
  reasonForConsultation?: string;
  medicalBackground?: MedicalBackground;
  familyHistory?: FamilyHistory;
  allergies?: string;
  odontogram?: Odontogram;
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

export interface ProfessionalProfile {
  id: string;
  dni: string | null;
  fullName: string | null;
  email: string | null;
  clinicName: string | null;
  licenseNumber: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  province: string | null;
  locality: string | null;
  updatedAt: string | null;
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
