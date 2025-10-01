import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  assignOrthodonticPlanToPatient,
  getPatientOrthodonticPlan,
  listOrthodonticPlans,
  removePatientOrthodonticPlan,
} from '@/lib/db/supabase-repository';
import { resolvePatientAccess } from '@/lib/patients/patient-access';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const access = await resolvePatientAccess(user, params.id);

    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const { patient, ownerProfessionalId } = access;
    const [plan, plans] = await Promise.all([
      getPatientOrthodonticPlan(ownerProfessionalId, patient.id),
      listOrthodonticPlans(ownerProfessionalId),
    ]);

    return NextResponse.json({ plan, plans });
  } catch (error) {
    console.error('Error al obtener plan asignado', error);
    return NextResponse.json(
      { error: 'No pudimos cargar el plan de ortodoncia del paciente' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const access = await resolvePatientAccess(user, params.id);

    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const { patient, ownerProfessionalId } = access;
    const body = await request.json();
    const planId = typeof body?.planId === 'string' ? body.planId : undefined;

    if (!planId) {
      return NextResponse.json(
        { error: 'Debes seleccionar un plan de ortodoncia.' },
        { status: 400 },
      );
    }

    const assignment = await assignOrthodonticPlanToPatient(ownerProfessionalId, patient.id, planId);
    return NextResponse.json({ success: true, plan: assignment });
  } catch (error) {
    console.error('Error al asignar plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos asignar el plan de ortodoncia' },
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

  try {
    const params = await context.params;
    const access = await resolvePatientAccess(user, params.id);

    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const { patient, ownerProfessionalId } = access;
    await removePatientOrthodonticPlan(ownerProfessionalId, patient.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al quitar plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos quitar el plan de ortodoncia' },
      { status: 500 },
    );
  }
}
