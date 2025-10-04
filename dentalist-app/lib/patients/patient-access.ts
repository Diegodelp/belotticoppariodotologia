import { getPatientById } from '@/lib/db/supabase-repository';
import { Patient, User } from '@/types';

type PatientAccessSuccess = {
  ok: true;
  patient: Patient;
  ownerProfessionalId: string;
  teamRestricted: boolean;
};

type PatientAccessFailure = {
  ok: false;
  ownerProfessionalId: string;
  status: number;
  message: string;
};

export type PatientAccessResult = PatientAccessSuccess | PatientAccessFailure;

export async function resolvePatientAccess(
  user: User,
  patientId: string,
): Promise<PatientAccessResult> {
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const teamRestricted = Boolean(user.ownerProfessionalId && user.teamRole !== 'admin');

  const patient = await getPatientById(ownerProfessionalId, patientId);

  if (!patient) {
    return {
      ok: false,
      ownerProfessionalId,
      status: 404,
      message: 'Paciente no encontrado',
    };
  }

  if (teamRestricted && user.teamClinicId && patient.clinicId !== user.teamClinicId) {
    return {
      ok: false,
      ownerProfessionalId,
      status: 404,
      message: 'Paciente no encontrado',
    };
  }

  return {
    ok: true,
    patient,
    ownerProfessionalId,
    teamRestricted,
  };
}
