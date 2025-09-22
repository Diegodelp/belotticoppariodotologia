import { NextRequest, NextResponse } from 'next/server';
import { addPatient, getPatients } from '@/lib/db/data-store';
import { Patient } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const status = searchParams.get('status');

  let patients = getPatients();

  if (search) {
    patients = patients.filter((patient) => {
      const haystack = `${patient.name} ${patient.lastName} ${patient.dni}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (status === 'active' || status === 'inactive') {
    patients = patients.filter((patient) => patient.status === status);
  }

  return NextResponse.json(patients);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      lastName,
      dni,
      email,
      phone,
      address,
      healthInsurance,
      status = 'active',
    } = body ?? {};

    if (!name || !lastName || !dni || !email) {
      return NextResponse.json(
        { error: 'Nombre, apellido, DNI y email son obligatorios' },
        { status: 400 },
      );
    }

    const patient: Patient = {
      id: crypto.randomUUID(),
      name,
      lastName,
      dni,
      email,
      phone: phone ?? '',
      address: address ?? '',
      healthInsurance: healthInsurance ?? 'Particular',
      status,
    };

    addPatient(patient);

    return NextResponse.json({ success: true, patient });
  } catch (error) {
    console.error('Error al crear paciente', error);
    return NextResponse.json(
      { error: 'No pudimos crear el paciente' },
      { status: 500 },
    );
  }
}