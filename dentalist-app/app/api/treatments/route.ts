import { NextRequest, NextResponse } from 'next/server';
import { addTreatment, getTreatments, getPatients } from '@/lib/db/data-store';
import { Treatment } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const type = searchParams.get('type');

  let treatments = getTreatments(patientId);

  if (type) {
    treatments = treatments.filter((item) =>
      item.type.toLowerCase().includes(type.toLowerCase()),
    );
  }

  const patients = getPatients();
  const withPatient = treatments.map((treatment) => ({
    ...treatment,
    patient: patients.find((patient) => patient.id === treatment.patientId),
  }));

  return NextResponse.json(withPatient);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, type, description, cost, date } = body ?? {};

    if (!patientId || !type || !description || !cost || !date) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    const treatment: Treatment = {
      id: crypto.randomUUID(),
      patientId,
      type,
      description,
      cost,
      date,
    };

    addTreatment(treatment);
    return NextResponse.json({ success: true, treatment });
  } catch (error) {
    console.error('Error al registrar tratamiento', error);
    return NextResponse.json(
      { error: 'No pudimos registrar el tratamiento' },
      { status: 500 },
    );
  }
}
