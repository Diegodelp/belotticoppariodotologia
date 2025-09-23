import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getPatientById,
  getClinicalHistory,
  listAppointments,
  listPrescriptions,
  listPayments,
  listTreatments,
  removePatient,
  updatePatient,
} from '@/lib/db/supabase-repository';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const params = await context.params;
  const patient = await getPatientById(user.id, params.id);
  if (!patient) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  const [appointments, treatments, payments, clinicalHistory, prescriptions] = await Promise.all([
    listAppointments(user.id, patient.id),
    listTreatments(user.id, patient.id),
    listPayments(user.id, patient.id),
    getClinicalHistory(user.id, patient.id),
    listPrescriptions(user.id, patient.id),
  ]);

  return NextResponse.json({
    patient,
    appointments,
    treatments,
    payments,
    clinicalHistory,
    prescriptions,
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
    const body = await request.json();
    const updates = {
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
    const updated = await updatePatient(user.id, params.id, updates);

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
  const deleted = await removePatient(user.id, params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}