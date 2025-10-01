import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { getClinicalHistory, upsertClinicalHistory } from '@/lib/db/supabase-repository';
import {
  ClinicalHistoryInput,
  ClinicalStage,
  OdontogramCondition,
  OdontogramMarkStatus,
  OdontogramSurface,
  OdontogramSurfaceMark,
} from '@/types';
import { resolvePatientAccess } from '@/lib/patients/patient-access';

const ALLOWED_STAGES: ClinicalStage[] = ['initial', 'intermediate', 'final'];
const ODONTOGRAM_CONDITIONS: OdontogramCondition[] = [
  'caries',
  'extraction',
  'sealant',
  'crown',
  'endodontic',
];
const ODONTOGRAM_SURFACES: OdontogramSurface[] = [
  'mesial',
  'distal',
  'occlusal',
  'vestibular',
  'lingual',
  'whole',
  'crown',
];
const ODONTOGRAM_STATUSES: OdontogramMarkStatus[] = ['planned', 'completed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

  const reasonForConsultation = sanitizeString(isBodyRecord ? body.reasonForConsultation : undefined);
  const allergies = sanitizeString(isBodyRecord ? body.allergies : undefined);

  const medicalBackgroundPayload =
    isBodyRecord && isRecord(body.medicalBackground)
      ? (body.medicalBackground as Record<string, unknown>)
      : null;

  const medicalBackground: ClinicalHistoryInput['medicalBackground'] | undefined = medicalBackgroundPayload
    ? {
        personalHistory: sanitizeString(medicalBackgroundPayload.personalHistory),
        systemicConditions: sanitizeString(medicalBackgroundPayload.systemicConditions),
        medications: sanitizeString(medicalBackgroundPayload.medications),
        surgicalHistory: sanitizeString(medicalBackgroundPayload.surgicalHistory),
        notes: sanitizeString(medicalBackgroundPayload.notes),
      }
    : undefined;

  const hasMedicalBackground = medicalBackground
    ? Object.values(medicalBackground).some((value) => typeof value === 'string' && value.length > 0)
    : false;

  const familyHistoryPayload =
    isBodyRecord && isRecord(body.familyHistory)
      ? (body.familyHistory as Record<string, unknown>)
      : null;

  const familyHistory: ClinicalHistoryInput['familyHistory'] | undefined = familyHistoryPayload
    ? {
        father: sanitizeString(familyHistoryPayload.father),
        mother: sanitizeString(familyHistoryPayload.mother),
        siblings: sanitizeString(familyHistoryPayload.siblings),
        others: sanitizeString(familyHistoryPayload.others),
      }
    : undefined;

  const hasFamilyHistory = familyHistory
    ? Object.values(familyHistory).some((value) => typeof value === 'string' && value.length > 0)
    : false;

  const odontogramPayload =
    isBodyRecord && isRecord(body.odontogram)
      ? (body.odontogram as Record<string, unknown>)
      : null;

  const odontogramEntries: NonNullable<ClinicalHistoryInput['odontogram']> = {};

  if (odontogramPayload) {
    for (const [tooth, value] of Object.entries(odontogramPayload)) {
      if (!isRecord(value)) {
        continue;
      }

      const toothState: Partial<Record<OdontogramSurface, OdontogramSurfaceMark>> = {};

      for (const surface of ODONTOGRAM_SURFACES) {
        const surfaceValue = value[surface];
        if (!isRecord(surfaceValue)) {
          continue;
        }

        const condition = surfaceValue.condition;
        const status = surfaceValue.status;

        if (
          typeof condition === 'string' &&
          (ODONTOGRAM_CONDITIONS as string[]).includes(condition) &&
          typeof status === 'string' &&
          (ODONTOGRAM_STATUSES as string[]).includes(status)
        ) {
          toothState[surface] = {
            condition: condition as OdontogramCondition,
            status: status as OdontogramMarkStatus,
          };
        }
      }

      if (Object.keys(toothState).length === 0) {
        for (const condition of ODONTOGRAM_CONDITIONS) {
          if (value[condition] === true) {
            toothState.whole = {
              condition,
              status: 'planned',
            };
            break;
          }
        }
      }

      if (Object.keys(toothState).length > 0) {
        odontogramEntries[tooth] = toothState as Record<OdontogramSurface, OdontogramSurfaceMark>;
      }
    }
  }

  return {
    summary,
    stages,
    reasonForConsultation,
    allergies,
    medicalBackground: hasMedicalBackground ? medicalBackground : undefined,
    familyHistory: hasFamilyHistory ? familyHistory : undefined,
    odontogram: Object.keys(odontogramEntries).length > 0 ? odontogramEntries : undefined,
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
  const access = await resolvePatientAccess(user, params.id);

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { patient, ownerProfessionalId } = access;

  try {
    const history = await getClinicalHistory(ownerProfessionalId, patient.id);
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
  const access = await resolvePatientAccess(user, params.id);

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { patient, ownerProfessionalId } = access;

  try {
    const body = await request.json();
    const input = sanitizeInput(body);
    const updated = await upsertClinicalHistory(ownerProfessionalId, patient.id, input);

    return NextResponse.json({ success: true, clinicalHistory: updated });
  } catch (error) {
    console.error('Error al guardar historia clínica', error);
    return NextResponse.json(
      { error: 'No pudimos guardar la historia clínica' },
      { status: 500 },
    );
  }
}
