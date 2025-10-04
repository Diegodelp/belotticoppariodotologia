export type SubscriptionPlan = 'starter' | 'pro';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'trial_expired' | 'cancelled';

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
  clinicId?: string | null;
  clinicName?: string | null;
}

export interface PatientInvite {
  id: string;
  professionalId: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string | null;
}

export type StaffRole = 'admin' | 'professional' | 'assistant';

export type StaffStatus = 'invited' | 'active' | 'inactive' | 'removed';

export interface Clinic {
  id: string;
  ownerProfessionalId: string;
  name: string;
  address?: string | null;
  calendarId?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface StaffMember {
  id: string;
  ownerProfessionalId: string;
  memberProfessionalId?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  fullName: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  invitedAt: string | null;
  acceptedAt?: string | null;
  statusReason?: string | null;
  statusChangedAt?: string | null;
}

export type StaffInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface StaffInvitation {
  id: string;
  ownerProfessionalId: string;
  clinicId?: string | null;
  clinicName?: string | null;
  email: string;
  role: StaffRole;
  status: StaffInvitationStatus;
  invitedAt: string;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  token?: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  version: number;
}

export interface ProfessionalKeyStatus {
  professionalId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string;
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
  calendarId?: string | null;
  clinicId?: string | null;
  checkedInAt?: string | null;
  checkedInByName?: string | null;
  calledAt?: string | null;
  calledByName?: string | null;
  calledBox?: string | null;
}

export type ClinicalMediaCategory = 'photo' | 'radiograph' | 'document';

export type ClinicalMediaLabel =
  | 'frente'
  | 'perfil'
  | 'derecho'
  | 'izquierdo'
  | 'panoramica'
  | 'teleradiografia'
  | 'inicial'
  | 'final'
  | 'otros'
  | 'intraoral_superior'
  | 'intraoral_inferior';

export interface ClinicalMedia {
  id: string;
  patientId: string;
  professionalId: string;
  category: ClinicalMediaCategory;
  label: ClinicalMediaLabel;
  fileName: string | null;
  mimeType: string | null;
  fileSize?: number | null;
  url: string;
  uploadedAt: string;
  validUntil?: string | null;
}

export interface TreatmentConsent {
  pdfUrl?: string | null;
  pdfName?: string | null;
  signedAt?: string | null;
  patientName?: string | null;
  patientSignatureUrl?: string | null;
  status?: 'signed' | 'pending';
}

export interface Treatment {
  id: string;
  patientId: string;
  type: string;
  description: string;
  cost: number;
  date: string;
  consent?: TreatmentConsent | null;
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

export interface OrthodonticPlan {
  id: string;
  professionalId: string;
  name: string;
  monthlyFee: number;
  hasInitialFee: boolean;
  initialFee?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientOrthodonticPlan {
  id: string;
  patientId: string;
  planId: string;
  professionalId: string;
  name: string;
  monthlyFee: number;
  hasInitialFee: boolean;
  initialFee?: number | null;
  assignedAt: string;
  treatmentGoal?: string | null;
  appliance?: string | null;
  controlFrequency?: string | null;
  estimatedDuration?: string | null;
  planNotes?: string | null;
}

export interface UpdateOrthodonticPlanDetailsInput {
  treatmentGoal?: string | null;
  appliance?: string | null;
  controlFrequency?: string | null;
  estimatedDuration?: string | null;
  planNotes?: string | null;
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
  signatureClarification: string | null;
  signatureUrl: string | null;
  signatureUpdatedAt: string | null;
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
  signatureClarification?: string;
  signatureDataUrl?: string | null;
  removeSignature?: boolean;
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
  timeZone: string | null;
  logoUrl: string | null;
  logoPath?: string | null;
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

export type BudgetPractice =
  | 'operatoria'
  | 'exodoncia'
  | 'limpieza'
  | 'blanqueamiento'
  | 'implante'
  | 'corona'
  | 'carilla'
  | 'perno'
  | 'endodoncia'
  | 'urgencia'
  | 'regeneracionTisular'
  | 'otro';

export interface BudgetItem {
  id: string;
  budgetId: string;
  practice: BudgetPractice;
  description?: string | null;
  amount: number;
}

export interface Budget {
  id: string;
  professionalId: string;
  patientId: string;
  title: string;
  notes?: string | null;
  total: number;
  documentUrl?: string | null;
  createdAt: string;
  items: BudgetItem[];
}

export interface CreateBudgetInput {
  title: string;
  notes?: string;
  items: Array<{
    practice: BudgetPractice;
    description?: string;
    amount: number;
  }>;
}
