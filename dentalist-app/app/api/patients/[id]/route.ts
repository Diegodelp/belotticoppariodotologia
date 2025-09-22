import { NextRequest, NextResponse } from 'next/server';
import {
  getAppointments,
  getPayments,
  getPatients,
  getTreatments,
  removePatient,
  updatePatient,
} from '@/lib/db/data-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const patient = getPatients().find((item) => item.id === params.id);
  if (!patient) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  const appointments = getAppointments(patient.id);
  const treatments = getTreatments(patient.id);
  const payments = getPayments(patient.id);

  return NextResponse.json({ patient, appointments, treatments, payments });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const updated = updatePatient(params.id, body);

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
  { params }: { params: { id: string } },
) {
  const deleted = removePatient(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}