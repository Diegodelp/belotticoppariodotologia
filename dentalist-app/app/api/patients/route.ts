import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createPatient,
  listPatients,
} from '@/lib/db/supabase-repository';
import { Patient } from '@/types';
import { getPatientLimit, userHasLockedSubscription } from '@/lib/utils/subscription';

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

    if (userHasLockedSubscription(user)) {
      return NextResponse.json(
        {
          error:
            'Tu prueba gratuita finalizó. Activá o renová tu suscripción para seguir incorporando pacientes.',
        },
        { status: 402 },
      );
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
      clinicName,
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
      clinicName:
        typeof clinicName === 'string' && clinicName.trim().length > 0
          ? clinicName.trim()
          : undefined,
    };

    if (user.type === 'profesional') {
      const patientLimit = getPatientLimit(user.subscriptionPlan ?? 'starter');
      if (typeof patientLimit === 'number') {
        const existing = await listPatients(user.id);
        if (existing.length >= patientLimit) {
          return NextResponse.json(
            {
              error:
                'Llegaste al límite de pacientes de tu plan Starter. Actualizá a Dentalist Pro para seguir creciendo.',
            },
            { status: 403 },
          );
        }
      }
    }

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