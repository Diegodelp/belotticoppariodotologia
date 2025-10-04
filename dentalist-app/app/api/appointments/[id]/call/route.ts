import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getAppointmentById,
  getProfessionalProfile,
  getProfessionalSubscriptionSummary,
  markAppointmentCalled,
} from '@/lib/db/supabase-repository';
import { resolvePatientAccess } from '@/lib/patients/patient-access';
import { isProPlan } from '@/lib/utils/subscription';
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
  const canCall =
    (!user.ownerProfessionalId && user.type === 'profesional') ||
    (user.ownerProfessionalId ? user.teamRole === 'professional' || user.teamRole === 'admin' : false);

  if (!canCall) {
    return NextResponse.json({ error: 'No tenés permisos para llamar pacientes en pantalla.' }, { status: 403 });
  }

  const { box } = await request.json().catch(() => ({ box: '' }));
  const trimmedBox = typeof box === 'string' ? box.trim() : '';

  if (!trimmedBox) {
    return NextResponse.json({ error: 'Indicá el box desde el que realizás el llamado.' }, { status: 400 });
  }

  const subscription = await getProfessionalSubscriptionSummary(ownerProfessionalId);

  if (!isProPlan(subscription.plan)) {
    return NextResponse.json(
      {
        error:
          'El llamado en pantalla está disponible para los planes Pro y Enterprise. Actualizá tu suscripción para usarlo.',
      },
      { status: 403 },
    );
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

  if (!appointment.checkedInAt) {
    return NextResponse.json(
      { error: 'El paciente todavía no fue recepcionado. Marcá su asistencia antes de llamarlo.' },
      { status: 409 },
    );
  }

  const profile = await getProfessionalProfile(ownerProfessionalId);
  const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);

  const updated = await markAppointmentCalled(ownerProfessionalId, params.id, {
    calledAt: new Date().toISOString(),
    calledBox: trimmedBox,
    calledByName: user.name,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    appointment: formatAppointmentForTimeZone(updated, timeZone),
  });
}
