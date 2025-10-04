import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  assignOrthodonticPlanToPatient,
  getPatientOrthodonticPlan,
  listOrthodonticPlans,
  removePatientOrthodonticPlan,
  updatePatientOrthodonticPlanDetails,
} from '@/lib/db/supabase-repository';
import { resolvePatientAccess } from '@/lib/patients/patient-access';

function sanitizeNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value === null) {
    return null;
  }
  return undefined;
}

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

export async function PATCH(
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
    const body = await request.json().catch(() => ({}));
    const updates = {
      treatmentGoal: sanitizeNullableString(body?.treatmentGoal),
      appliance: sanitizeNullableString(body?.appliance),
      controlFrequency: sanitizeNullableString(body?.controlFrequency),
      estimatedDuration: sanitizeNullableString(body?.estimatedDuration),
      planNotes: sanitizeNullableString(body?.planNotes),
    };

    if (!Object.values(updates).some((value) => value !== undefined)) {
      return NextResponse.json(
        { error: 'No se enviaron cambios para actualizar.' },
        { status: 400 },
      );
    }

    try {
      const plan = await updatePatientOrthodonticPlanDetails(ownerProfessionalId, patient.id, updates);
      return NextResponse.json({ success: true, plan });
    } catch (error) {
      console.error('Error al actualizar detalles del plan de ortodoncia', error);
      return NextResponse.json(
        { error: 'No pudimos actualizar los detalles del plan de ortodoncia.' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error en PATCH de plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al actualizar el plan.' },
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
