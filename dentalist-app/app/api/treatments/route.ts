import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createTreatment,
  listPatients,
  listTreatments,
  updateTreatment,
  deleteTreatment,
} from '@/lib/db/supabase-repository';
import { Treatment, Patient } from '@/types';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const type = searchParams.get('type');

  try {
    const [treatments, patients] = await Promise.all([
      listTreatments(user.id, patientId ?? undefined),
      listPatients(user.id),
    ]);

    const filtered = type
      ? treatments.filter((item) =>
          item.type.toLowerCase().includes(type.toLowerCase()),
        )
      : treatments;

    const patientMap = new Map(patients.map((patient) => [patient.id, patient] as [string, Patient]));

    const withPatient = filtered.map((treatment) => ({
      ...treatment,
      patient: patientMap.get(treatment.patientId),
    }));

    return NextResponse.json(withPatient);
  } catch (error) {
    console.error('Error al obtener tratamientos en Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener los tratamientos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const body = await request.json();
    const { patientId, type, description, cost, date } = body ?? {};

    if (!patientId || !type || !description || !cost || !date) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    const treatment: Treatment = await createTreatment(user.id, {
      patientId,
      type,
      description,
      cost,
      date,
    });

    return NextResponse.json({ success: true, treatment });
  } catch (error) {
    console.error('Error al registrar tratamiento', error);
    return NextResponse.json(
      { error: 'No pudimos registrar el tratamiento' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, type, description, cost, date } = body ?? {};

    if (!id || !type || !description || !date || Number.isNaN(Number(cost))) {
      return NextResponse.json(
        { error: 'Debés indicar tratamiento, descripción, fecha y monto válidos.' },
        { status: 400 },
      );
    }

    const treatment = await updateTreatment(user.id, id, {
      type: String(type),
      description: String(description),
      cost: Number(cost),
      date: new Date(date).toISOString(),
    });

    return NextResponse.json({ success: true, treatment });
  } catch (error) {
    console.error('Error al actualizar tratamiento', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos actualizar el tratamiento' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const treatmentId = searchParams.get('treatmentId') ?? searchParams.get('id');

    if (!treatmentId) {
      return NextResponse.json({ error: 'Identificador de tratamiento inválido.' }, { status: 400 });
    }

    await deleteTreatment(user.id, treatmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar tratamiento', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos eliminar el tratamiento' },
      { status: 500 },
    );
  }
}
