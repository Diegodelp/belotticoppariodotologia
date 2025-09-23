import { NextRequest, NextResponse } from 'next/server';

import { getSharp } from '@/lib/utils/sharp';

import sharp from 'sharp';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createPrescriptionRecord,
  downloadProfessionalSignature,
  getPatientById,
  getProfessionalSignature,
  listPrescriptions,
  saveProfessionalSignature,
} from '@/lib/db/supabase-repository';
import { generatePrescriptionPdf } from '@/lib/documents/prescription-pdf';
import { CreatePrescriptionInput } from '@/types';


export const runtime = 'nodejs';

function parseSignatureDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const matches = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!matches) {
    throw new Error('Firma inválida');
  }
  const mimeType = matches[1];
  const base64 = matches[2];
  return {
    buffer: Buffer.from(base64, 'base64'),
    mimeType,
  };
}

async function bufferToPngDataUrl(buffer: Buffer): Promise<{ buffer: Buffer; dataUrl: string }> {

  const sharp = await getSharp();

  const pngBuffer = await sharp(buffer).png().toBuffer();
  return {
    buffer: pngBuffer,
    dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
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
    const prescriptions = await listPrescriptions(user.id, patient.id);
    return NextResponse.json({ prescriptions });
  } catch (error) {
    console.error('Error al obtener recetas', error);
    return NextResponse.json({ error: 'No pudimos cargar las recetas' }, { status: 500 });
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
  const patient = await getPatientById(user.id, params.id);

  if (!patient) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as CreatePrescriptionInput;

    if (!body?.title || !body?.medication || !body?.instructions) {
      return NextResponse.json(
        { error: 'Título, medicación e indicaciones son obligatorios' },
        { status: 400 },
      );
    }

    let signatureDataUrl: string | undefined;
    let signaturePath: string | null | undefined;

    if (body.useStoredSignature) {
      const stored = await downloadProfessionalSignature(user.id);
      if (!stored) {
        return NextResponse.json(
          { error: 'No existe una firma guardada. Dibujá una nueva para continuar.' },
          { status: 400 },
        );
      }
      const pngSignature = await bufferToPngDataUrl(stored.buffer);
      signatureDataUrl = pngSignature.dataUrl;
      signaturePath = stored.storagePath;
    } else if (body.signatureDataUrl) {
      const parsed = parseSignatureDataUrl(body.signatureDataUrl);
      const pngSignature = await bufferToPngDataUrl(parsed.buffer);
      signatureDataUrl = pngSignature.dataUrl;

      if (body.saveSignature) {
        const saved = await saveProfessionalSignature(user.id, {
          buffer: pngSignature.buffer,
          mimeType: 'image/png',
        });
        signaturePath = saved.storagePath;
      }
    }

    if (!signatureDataUrl) {
      return NextResponse.json(
        { error: 'Necesitás adjuntar una firma digital para emitir la receta.' },
        { status: 400 },
      );
    }

    const pdfBuffer = await generatePrescriptionPdf({
      title: body.title,
      patientName: `${patient.name} ${patient.lastName}`.trim(),
      patientDni: patient.dni,
      healthInsurance: patient.healthInsurance,
      affiliateNumber: patient.affiliateNumber,
      professionalName: user.name,
      professionalDni: user.dni,
      diagnosis: body.diagnosis,
      medication: body.medication,
      instructions: body.instructions,
      notes: body.notes,
      issuedAt: new Date(),
      signatureDataUrl,
    });

    const prescription = await createPrescriptionRecord(user.id, patient.id, {
      title: body.title,
      diagnosis: body.diagnosis ?? null,
      medication: body.medication,
      instructions: body.instructions,
      notes: body.notes ?? null,
      pdfBuffer,
      signaturePath: signaturePath ?? null,
    });

    if (body.useStoredSignature && !signaturePath) {
      // Refresh signature metadata if it existed previously.
      const latestSignature = await getProfessionalSignature(user.id);
      signaturePath = latestSignature?.storage_path ?? null;
    }

    return NextResponse.json({ success: true, prescription });
  } catch (error) {
    console.error('Error al crear receta', error);
    return NextResponse.json(
      { error: 'No pudimos generar la receta en este momento' },
      { status: 500 },
    );
  }
}
