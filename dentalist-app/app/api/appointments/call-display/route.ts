import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getLatestCalledAppointment,
  getProfessionalProfile,
  getProfessionalSubscriptionSummary,
} from '@/lib/db/supabase-repository';
import { resolvePatientAccess } from '@/lib/patients/patient-access';
import { isProPlan } from '@/lib/utils/subscription';
import { DEFAULT_TIME_ZONE, formatAppointmentForTimeZone, normalizeTimeZone } from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const subscription = await getProfessionalSubscriptionSummary(ownerProfessionalId);

  if (!isProPlan(subscription.plan)) {
    return NextResponse.json(
      {
        error:
          'La pantalla de llamados está disponible para los planes Pro y Enterprise. Actualizá tu plan para utilizarla.',
      },
      { status: 403 },
    );
  }

  const teamRestricted = Boolean(user.ownerProfessionalId && user.teamRole !== 'admin');

  const { searchParams } = new URL(request.url);
  const requestedClinicId = searchParams.get('clinicId');

  let clinicId: string | null = null;
  if (teamRestricted) {
    clinicId = user.teamClinicId ?? null;
  } else if (requestedClinicId && requestedClinicId !== 'all') {
    clinicId = requestedClinicId;
  }

  if (teamRestricted && clinicId && user.teamClinicId && clinicId !== user.teamClinicId) {
    return NextResponse.json({ error: 'No tenés acceso a ese consultorio.' }, { status: 403 });
  }

  const latest = await getLatestCalledAppointment(ownerProfessionalId, { clinicId: clinicId ?? undefined });

  if (!latest) {
    return NextResponse.json({ appointment: null });
  }

  if (teamRestricted && user.teamClinicId && latest.clinicId && latest.clinicId !== user.teamClinicId) {
    return NextResponse.json({ appointment: null });
  }

  let patient = null;
  if (latest.patientId) {
    const access = await resolvePatientAccess(user, latest.patientId);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    patient = access.patient;
  }

  const profile = await getProfessionalProfile(ownerProfessionalId);
  const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);

  return NextResponse.json({
    appointment: formatAppointmentForTimeZone(latest, timeZone),
    patient: patient
      ? {
          id: patient.id,
          name: patient.name,
          lastName: patient.lastName,
          clinicId: patient.clinicId ?? null,
          clinicName: patient.clinicName ?? null,
        }
      : null,
  });
}
