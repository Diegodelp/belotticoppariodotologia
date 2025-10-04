import { getClinicByIdForOwner } from '@/lib/db/supabase-repository';
import { User } from '@/types';

type ClinicResolutionSuccess = { ok: true; clinicId: string | null; clinicName: string | null };
type ClinicResolutionError = { ok: false; status: number; message: string };

export type ClinicResolution = ClinicResolutionSuccess | ClinicResolutionError;

export async function resolveClinicAssignment(
  user: User,
  requestedClinicId: string | null,
): Promise<ClinicResolution> {
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;

  try {
    const isTeamMember = Boolean(user.ownerProfessionalId);
    const isTeamAdmin = isTeamMember && user.teamRole === 'admin';

    if (isTeamMember && !isTeamAdmin) {
      const assignedClinicId = user.teamClinicId ?? null;
      if (!assignedClinicId) {
        return {
          ok: false,
          status: 400,
          message: 'No tenés un consultorio asignado. Pedile al administrador que te vincule a uno.',
        };
      }
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, assignedClinicId);
      if (!clinic) {
        return {
          ok: false,
          status: 400,
          message: 'El consultorio asignado ya no está disponible. Actualizá tu acceso con el administrador.',
        };
      }
      return { ok: true, clinicId: clinic.id, clinicName: clinic.name };
    }

    if (requestedClinicId) {
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, requestedClinicId);
      if (!clinic) {
        return {
          ok: false,
          status: 400,
          message: 'El consultorio seleccionado no es válido para tu cuenta.',
        };
      }
      return { ok: true, clinicId: clinic.id, clinicName: clinic.name };
    }

    if (user.teamClinicId) {
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, user.teamClinicId);
      if (clinic) {
        return { ok: true, clinicId: clinic.id, clinicName: clinic.name };
      }
    }

    return { ok: true, clinicId: null, clinicName: null };
  } catch (error) {
    console.error('Error al validar el consultorio del paciente', error);
    return {
      ok: false,
      status: 500,
      message: 'No pudimos validar el consultorio seleccionado. Intentá nuevamente.',
    };
  }
}
