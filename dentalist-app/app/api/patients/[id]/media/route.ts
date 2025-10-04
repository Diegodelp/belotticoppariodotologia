import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { deletePatientMedia, listPatientMedia, savePatientMedia } from '@/lib/db/supabase-repository';
import { ClinicalMediaCategory, ClinicalMediaLabel } from '@/types';
import { resolvePatientAccess } from '@/lib/patients/patient-access';

export const runtime = 'nodejs';

const PHOTO_LABELS: ClinicalMediaLabel[] = [
  'frente',
  'perfil',
  'derecho',
  'izquierdo',
  'intraoral_superior',
  'intraoral_inferior',
];

const RADIOGRAPH_LABELS: ClinicalMediaLabel[] = ['panoramica', 'teleradiografia'];

function isClinicalMediaCategory(value: string): value is ClinicalMediaCategory {
  return value === 'photo' || value === 'radiograph' || value === 'document';
}

function isClinicalMediaLabel(value: string): value is ClinicalMediaLabel {
  return (
    PHOTO_LABELS.includes(value as ClinicalMediaLabel) ||
    RADIOGRAPH_LABELS.includes(value as ClinicalMediaLabel) ||
    value === 'otros' ||
    value === 'inicial' ||
    value === 'final'
  );
}

function isLabelAllowedForCategory(category: ClinicalMediaCategory, label: ClinicalMediaLabel) {
  if (category === 'photo') {
    return PHOTO_LABELS.includes(label);
  }

  if (category === 'radiograph') {
    return RADIOGRAPH_LABELS.includes(label);
  }

  return true;
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
    const media = await listPatientMedia(ownerProfessionalId, patient.id);
    return NextResponse.json({ media });
  } catch (error) {
    console.error('Error al obtener media clínica', error);
    return NextResponse.json({ error: 'No pudimos obtener los archivos del paciente.' }, { status: 500 });
  }
}

export async function POST(
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

  const formData = await request.formData();
  const categoryValue = formData.get('category');
  const labelValue = formData.get('label');
  const file = formData.get('file');

  if (typeof categoryValue !== 'string' || !isClinicalMediaCategory(categoryValue)) {
    return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 });
  }

  if (typeof labelValue !== 'string' || !isClinicalMediaLabel(labelValue)) {
    return NextResponse.json({ error: 'Etiqueta inválida.' }, { status: 400 });
  }

  const category = categoryValue as ClinicalMediaCategory;
  const label = labelValue as ClinicalMediaLabel;

  if (!isLabelAllowedForCategory(category, label)) {
    return NextResponse.json({ error: 'La etiqueta no corresponde a la categoría seleccionada.' }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá un archivo válido.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 });
  }

  try {
    const media = await savePatientMedia(ownerProfessionalId, patient.id, {
      buffer: Buffer.from(arrayBuffer),
      fileName: typeof file.name === 'string' ? file.name : undefined,
      mimeType: file.type || 'application/octet-stream',
      category,
      label,
    });

    return NextResponse.json({ success: true, media });
  } catch (error) {
    console.error('Error al subir media clínica', error);
    return NextResponse.json({ error: 'No pudimos subir el archivo. Intentá nuevamente.' }, { status: 500 });
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

  const params = await context.params;
  const access = await resolvePatientAccess(user, params.id);

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { patient, ownerProfessionalId } = access;

  const mediaId = request.nextUrl.searchParams.get('mediaId');

  if (!mediaId) {
    return NextResponse.json({ error: 'Falta el identificador del archivo clínico.' }, { status: 400 });
  }

  try {
    await deletePatientMedia(ownerProfessionalId, patient.id, mediaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Archivo clínico no encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error al eliminar media clínica', error);
    return NextResponse.json({ error: 'No pudimos eliminar el archivo.' }, { status: 500 });
  }
}
