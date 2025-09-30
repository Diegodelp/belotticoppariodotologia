import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getPatientById,
  getClinicalHistory,
  getPatientOrthodonticPlan,
  getProfessionalProfile,
  listPatientMedia,
  listAppointments,
  listBudgets,
  listPrescriptions,
  listPayments,
  listTreatments,
  removePatient,
  updatePatient,
} from '@/lib/db/supabase-repository';
import {
  DEFAULT_TIME_ZONE,
  formatAppointmentsForTimeZone,
  normalizeTimeZone,
} from '@/lib/utils/timezone';
import { resolveClinicAssignment } from '@/lib/patients/clinic-assignment';
import { Patient } from '@/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const params = await context.params;
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const teamRestricted = Boolean(user.ownerProfessionalId && user.teamRole !== 'admin');
  const patient = await getPatientById(ownerProfessionalId, params.id);
  if (!patient) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  if (teamRestricted && user.teamClinicId && patient.clinicId !== user.teamClinicId) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  const [
    profile,
    appointmentsRaw,
    treatments,
    payments,
    clinicalHistory,
    prescriptions,
    orthodonticPlan,
    budgets,
    media,
  ] = await Promise.all([
    getProfessionalProfile(ownerProfessionalId),
    listAppointments(ownerProfessionalId, patient.id),
    listTreatments(ownerProfessionalId, patient.id),
    listPayments(ownerProfessionalId, patient.id),
    getClinicalHistory(ownerProfessionalId, patient.id),
    listPrescriptions(ownerProfessionalId, patient.id),
    getPatientOrthodonticPlan(ownerProfessionalId, patient.id),
    listBudgets(ownerProfessionalId, patient.id),
    listPatientMedia(ownerProfessionalId, patient.id),
  ]);

  const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
  const appointments = formatAppointmentsForTimeZone(appointmentsRaw, timeZone);

  return NextResponse.json({
    patient,
    appointments,
    treatments,
    payments,
    clinicalHistory,
    prescriptions,
    orthodonticPlan,
    budgets,
    media,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const params = await context.params;
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
    const teamRestricted = Boolean(user.ownerProfessionalId && user.teamRole !== 'admin');
    if (teamRestricted && user.teamClinicId) {
      const currentPatient = await getPatientById(ownerProfessionalId, params.id);
      if (!currentPatient || currentPatient.clinicId !== user.teamClinicId) {
        return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
      }
    }
    const body = await request.json();
    const clinicIdProvided = Object.prototype.hasOwnProperty.call(body ?? {}, 'clinicId');
    let clinicIdUpdate: string | null | undefined = undefined;
    let clinicNameUpdate: string | null | undefined = undefined;

    if (user.ownerProfessionalId && user.teamRole !== 'admin') {
      const resolution = await resolveClinicAssignment(user, user.teamClinicId ?? null);
      if (!resolution.ok) {
        return NextResponse.json({ error: resolution.message }, { status: resolution.status });
      }
      clinicIdUpdate = resolution.clinicId;
      clinicNameUpdate = resolution.clinicName;
    } else if (clinicIdProvided) {
      const requestedClinicId =
        typeof body.clinicId === 'string' && body.clinicId.trim().length > 0 ? body.clinicId.trim() : null;
      const resolution = await resolveClinicAssignment(user, requestedClinicId);
      if (!resolution.ok) {
        return NextResponse.json({ error: resolution.message }, { status: resolution.status });
      }
      clinicIdUpdate = resolution.clinicId;
      clinicNameUpdate = resolution.clinicName;
    }

    const updates: Partial<Patient> = {
      name: body.name,
      lastName: body.lastName,
      dni: body.dni,
      email: body.email,
      phone: body.phone,
      address: body.address,
      healthInsurance: body.healthInsurance,
      affiliateNumber: body.affiliateNumber,
      status: body.status,
    };

    if (clinicIdUpdate !== undefined) {
      updates.clinicId = clinicIdUpdate;
    }
    if (clinicNameUpdate !== undefined) {
      updates.clinicName = clinicNameUpdate;
    }
    const updated = await updatePatient(ownerProfessionalId, params.id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Paciente no encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, patient: updated });
  } catch (error) {
    console.error('Error al actualizar paciente', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar el paciente' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const params = await context.params;
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const teamRestricted = Boolean(user.ownerProfessionalId && user.teamRole !== 'admin');
  if (teamRestricted && user.teamClinicId) {
    const currentPatient = await getPatientById(ownerProfessionalId, params.id);
    if (!currentPatient || currentPatient.clinicId !== user.teamClinicId) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }
  }
  const deleted = await removePatient(ownerProfessionalId, params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}