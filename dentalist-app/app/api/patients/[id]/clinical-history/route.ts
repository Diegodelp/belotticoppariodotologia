import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getClinicalHistory,
  getPatientById,
  upsertClinicalHistory,
} from '@/lib/db/supabase-repository';
import { ClinicalHistoryInput, ClinicalStage } from '@/types';

const ALLOWED_STAGES: ClinicalStage[] = ['baseline', 'initial', 'intermediate', 'final'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeInput(body: unknown): ClinicalHistoryInput {
  const isBodyRecord = isRecord(body);
  const summary = isBodyRecord && typeof body.summary === 'string' ? body.summary : undefined;
  const stagesPayload =
    isBodyRecord && isRecord(body.stages) ? (body.stages as Record<string, unknown>) : {};
  const stages: ClinicalHistoryInput['stages'] = {};

  for (const stage of ALLOWED_STAGES) {
    const values = isRecord(stagesPayload?.[stage]) ? (stagesPayload?.[stage] as Record<string, unknown>) : null;
    if (!values) {
      continue;
    }

    stages[stage] = {
      biotipo: typeof values.biotipo === 'string' ? values.biotipo : undefined,
      patronEsqueletal:
        typeof values.patronEsqueletal === 'string' ? values.patronEsqueletal : undefined,
      sna: typeof values.sna === 'string' ? values.sna : undefined,
      snb: typeof values.snb === 'string' ? values.snb : undefined,
      anb: typeof values.anb === 'string' ? values.anb : undefined,
      naMm: typeof values.naMm === 'string' ? values.naMm : undefined,
      naAngle: typeof values.naAngle === 'string' ? values.naAngle : undefined,
      nbMm: typeof values.nbMm === 'string' ? values.nbMm : undefined,
      nbAngle: typeof values.nbAngle === 'string' ? values.nbAngle : undefined,
      planoMandibular:
        typeof values.planoMandibular === 'string' ? values.planoMandibular : undefined,
    };
  }

  return {
    summary,
    stages,
  };
}

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

  try {
    const history = await getClinicalHistory(user.id, patient.id);
    return NextResponse.json({ clinicalHistory: history });
  } catch (error) {
    console.error('Error al obtener historia clínica', error);
    return NextResponse.json(
      { error: 'No pudimos cargar la historia clínica' },
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

  const params = await context.params;
  const patient = await getPatientById(user.id, params.id);

  if (!patient) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const input = sanitizeInput(body);
    const updated = await upsertClinicalHistory(user.id, patient.id, input);

    return NextResponse.json({ success: true, clinicalHistory: updated });
  } catch (error) {
    console.error('Error al guardar historia clínica', error);
    return NextResponse.json(
      { error: 'No pudimos guardar la historia clínica' },
      { status: 500 },
    );
  }
}
