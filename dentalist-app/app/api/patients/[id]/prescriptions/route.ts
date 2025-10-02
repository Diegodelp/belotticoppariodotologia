import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createPrescriptionRecord,
  deletePrescriptionRecord,
  downloadProfessionalLogo,
  downloadProfessionalSignature,
  getProfessionalProfile,
  getProfessionalSignature,
  listPrescriptions,
  saveProfessionalSignature,
} from '@/lib/db/supabase-repository';
import { generatePrescriptionPdf } from '@/lib/documents/prescription-pdf';
import { parsePng } from '@/lib/documents/png';
import { sendPrescriptionIssuedEmail } from '@/lib/email/mailer';
import { parseSignatureDataUrl } from '@/lib/utils/signature';
import { CreatePrescriptionInput } from '@/types';
import { resolvePatientAccess } from '@/lib/patients/patient-access';

export const runtime = 'nodejs';

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
    const prescriptions = await listPrescriptions(ownerProfessionalId, patient.id);
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
  const access = await resolvePatientAccess(user, params.id);

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { patient, ownerProfessionalId } = access;

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
      const mimeType = stored.mimeType || 'image/png';
      signatureDataUrl = `data:${mimeType};base64,${stored.buffer.toString('base64')}`;
      signaturePath = stored.storagePath;
    } else if (body.signatureDataUrl) {
      const parsed = parseSignatureDataUrl(body.signatureDataUrl);
      signatureDataUrl = body.signatureDataUrl;

      if (body.saveSignature) {
        const saved = await saveProfessionalSignature(user.id, {
          buffer: parsed.buffer,
          mimeType: parsed.mimeType,
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

    const [professionalProfile, logoAsset] = await Promise.all([
      getProfessionalProfile(user.id),
      downloadProfessionalLogo(ownerProfessionalId),
    ]);
    const clinicTitle =
      professionalProfile?.clinicName?.trim() || user.clinicName?.trim() || '';
    const professionalName = professionalProfile?.fullName?.trim() || user.name;
    const professionalDni = professionalProfile?.dni ?? user.dni;
    const professionalLicense = professionalProfile?.licenseNumber ?? user.licenseNumber ?? undefined;
    const professionalLocality = professionalProfile?.locality ?? user.locality ?? null;

    const pdfTitle = clinicTitle.length > 0 ? clinicTitle : 'Receta digital';

    let logoImage;
    if (logoAsset?.buffer) {
      try {
        logoImage = parsePng(logoAsset.buffer);
      } catch (error) {
        console.warn('No pudimos procesar el logo del profesional para la receta', error);
      }
    }

    const pdfBuffer = await generatePrescriptionPdf({
      title: pdfTitle,
      patientName: `${patient.name} ${patient.lastName}`.trim(),
      patientDni: patient.dni,
      healthInsurance: patient.healthInsurance,
      affiliateNumber: patient.affiliateNumber,
      professionalName,
      professionalDni,
      professionalLicense,
      professionalLocality: professionalLocality ?? undefined,
      diagnosis: body.diagnosis,
      medication: body.medication,
      instructions: body.instructions,
      notes: body.notes,
      issuedAt: new Date(),
      signatureDataUrl,
      logo: logoImage,
    });

    const prescription = await createPrescriptionRecord(ownerProfessionalId, patient.id, {
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

    if (patient.email) {
      try {
        await sendPrescriptionIssuedEmail({
          to: patient.email,
          patientName: `${patient.name} ${patient.lastName}`.trim(),
          professionalName: professionalName ?? user.name,
          prescriptionTitle: body.title,
          documentUrl: prescription.pdfUrl,
          clinicName: clinicTitle.length > 0 ? clinicTitle : undefined,
        });
      } catch (emailError) {
        console.error('No se pudo enviar la receta por correo', emailError);
        return NextResponse.json(
          {
            error:
              'La receta se generó pero no pudimos enviarla por correo electrónico. Intentá nuevamente en unos minutos.',
          },
          { status: 502 },
        );
      }
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

  const prescriptionId = request.nextUrl.searchParams.get('prescriptionId');

  if (!prescriptionId) {
    return NextResponse.json(
      { error: 'Falta el identificador de la receta a eliminar' },
      { status: 400 },
    );
  }

  try {
    await deletePrescriptionRecord(ownerProfessionalId, patient.id, prescriptionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar receta', error);
    return NextResponse.json(
      { error: 'No pudimos eliminar la receta en este momento' },
      { status: 500 },
    );
  }
}
