import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getAppointmentById,
  getProfessionalProfile,
  markAppointmentCheckedIn,
} from '@/lib/db/supabase-repository';
import { resolvePatientAccess } from '@/lib/patients/patient-access';
import { DEFAULT_TIME_ZONE, formatAppointmentForTimeZone, normalizeTimeZone } from '@/lib/utils/timezone';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const params = await context.params;
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const canCheckIn =
    (!user.ownerProfessionalId && user.type === 'profesional') ||
    (user.ownerProfessionalId ? user.teamRole === 'assistant' || user.teamRole === 'admin' : false);

  if (!canCheckIn) {
    return NextResponse.json({ error: 'No tenés permisos para registrar asistencia.' }, { status: 403 });
  }

  const appointment = await getAppointmentById(ownerProfessionalId, params.id);
  if (!appointment) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  if (user.ownerProfessionalId && user.teamRole !== 'admin') {
    const clinicScope = user.teamClinicId ?? null;
    const appointmentClinic = appointment.clinicId ?? null;
    if (clinicScope && appointmentClinic && appointmentClinic !== clinicScope) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
  }

  if (appointment.patientId) {
    const access = await resolvePatientAccess(user, appointment.patientId);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
  }

  const profile = await getProfessionalProfile(ownerProfessionalId);
  const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);

  if (appointment.checkedInAt) {
    return NextResponse.json({
      success: true,
      alreadyCheckedIn: true,
      appointment: formatAppointmentForTimeZone(appointment, timeZone),
    });
  }

  const updated = await markAppointmentCheckedIn(ownerProfessionalId, params.id, {
    checkedInAt: new Date().toISOString(),
    checkedInByName: user.name,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    appointment: formatAppointmentForTimeZone(updated, timeZone),
  });
}
