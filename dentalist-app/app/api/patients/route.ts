import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createPatient,
  listPatients,
} from '@/lib/db/supabase-repository';
import { Patient } from '@/types';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  try {
    const patients = await listPatients(user.id, { search, status });
    return NextResponse.json(patients);
  } catch (error) {
    console.error('Error al obtener pacientes de Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos cargar los pacientes' },
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
    const {
      name,
      lastName,
      dni,
      email,
      phone,
      address,
      healthInsurance,
      affiliateNumber,
      status = 'active',
    } = body ?? {};

    if (!name || !lastName || !dni || !email) {
      return NextResponse.json(
        { error: 'Nombre, apellido, DNI y email son obligatorios' },
        { status: 400 },
      );
    }

    const patient: Omit<Patient, 'id'> = {
      name,
      lastName,
      dni,
      email,
      phone: phone ?? '',
      address: address ?? '',
      healthInsurance: healthInsurance ?? 'Particular',
      affiliateNumber: affiliateNumber ?? undefined,
      status,
    };

    const created = await createPatient(user.id, patient);

    return NextResponse.json({ success: true, patient: created });
  } catch (error) {
    console.error('Error al crear paciente', error);
    return NextResponse.json(
      { error: 'No pudimos crear el paciente' },
      { status: 500 },
    );
  }
}