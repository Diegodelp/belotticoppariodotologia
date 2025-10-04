import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createTreatment,
  listPatients,
  listTreatments,
  updateTreatment,
  deleteTreatment,
} from '@/lib/db/supabase-repository';
import { Treatment, Patient } from '@/types';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const type = searchParams.get('type');

  try {
    const [treatments, patients] = await Promise.all([
      listTreatments(user.id, patientId ?? undefined),
      listPatients(user.id),
    ]);

    const filtered = type
      ? treatments.filter((item) =>
          item.type.toLowerCase().includes(type.toLowerCase()),
        )
      : treatments;

    const patientMap = new Map(patients.map((patient) => [patient.id, patient] as [string, Patient]));

    const withPatient = filtered.map((treatment) => ({
      ...treatment,
      patient: patientMap.get(treatment.patientId),
    }));

    return NextResponse.json(withPatient);
  } catch (error) {
    console.error('Error al obtener tratamientos en Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener los tratamientos' },
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
    const formData = await request.formData();
    const patientId = formData.get('patientId')?.toString().trim() ?? '';
    const type = formData.get('type')?.toString().trim() ?? '';
    const description = formData.get('description')?.toString().trim() ?? '';
    const date = formData.get('date')?.toString() ?? '';
    const costValue = Number(formData.get('cost'));
    const consentPatientName = formData.get('consentPatientName')?.toString().trim() ?? '';
    const consentFile = formData.get('consentFile');
    const consentSignature = formData.get('consentSignature');

    if (!patientId || !type || !description || !date || Number.isNaN(costValue)) {
      return NextResponse.json(
        { error: 'Todos los campos del tratamiento son obligatorios.' },
        { status: 400 },
      );
    }

    if (!consentPatientName) {
      return NextResponse.json(
        { error: 'Debés indicar el nombre y aclaración del paciente para el consentimiento.' },
        { status: 400 },
      );
    }

    if (!(consentFile instanceof File) || consentFile.size === 0) {
      return NextResponse.json(
        { error: 'Debés adjuntar el consentimiento informado en formato PDF.' },
        { status: 400 },
      );
    }

    if (!(consentSignature instanceof File) || consentSignature.size === 0) {
      return NextResponse.json(
        { error: 'Debés capturar la firma del paciente para validar el consentimiento.' },
        { status: 400 },
      );
    }

    const [pdfBuffer, signatureBuffer] = await Promise.all([
      consentFile.arrayBuffer().then((buffer) => Buffer.from(buffer)),
      consentSignature.arrayBuffer().then((buffer) => Buffer.from(buffer)),
    ]);

    const treatment: Treatment = await createTreatment(user.id, {
      patientId,
      type,
      description,
      cost: costValue,
      date,
      consent: {
        patientName: consentPatientName,
        pdf: {
          buffer: pdfBuffer,
          mimeType: consentFile.type || 'application/pdf',
          fileName: consentFile.name,
        },
        signature: {
          buffer: signatureBuffer,
          mimeType: consentSignature.type || 'image/png',
        },
      },
    });

    return NextResponse.json({ success: true, treatment });
  } catch (error) {
    console.error('Error al registrar tratamiento', error);
    return NextResponse.json(
      { error: 'No pudimos registrar el tratamiento' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const formData = await request.formData();
    const id = formData.get('id')?.toString();
    const type = formData.get('type')?.toString().trim() ?? '';
    const description = formData.get('description')?.toString().trim() ?? '';
    const date = formData.get('date')?.toString() ?? '';
    const costValue = Number(formData.get('cost'));
    const consentReplace = formData.get('consentReplace') === 'true';
    const consentPatientNameRaw = formData.get('consentPatientName');
    const consentFile = formData.get('consentFile');
    const consentSignature = formData.get('consentSignature');

    if (!id || !type || !description || !date || Number.isNaN(costValue)) {
      return NextResponse.json(
        { error: 'Debés indicar tratamiento, descripción, fecha y monto válidos.' },
        { status: 400 },
      );
    }

    const consentPatientName =
      consentPatientNameRaw !== null ? consentPatientNameRaw.toString().trim() : undefined;

    if (consentReplace) {
      if (!(consentFile instanceof File) || consentFile.size === 0) {
        return NextResponse.json(
          { error: 'Debés adjuntar el consentimiento informado en formato PDF.' },
          { status: 400 },
        );
      }
      if (!(consentSignature instanceof File) || consentSignature.size === 0) {
        return NextResponse.json(
          { error: 'Debés capturar la nueva firma del paciente para validar el consentimiento.' },
          { status: 400 },
        );
      }
      if (!consentPatientName) {
        return NextResponse.json(
          { error: 'Debés indicar el nombre y aclaración del paciente para el consentimiento.' },
          { status: 400 },
        );
      }
    }

    if (!consentReplace && consentPatientName !== undefined && !consentPatientName) {
      return NextResponse.json(
        { error: 'La aclaración del paciente no puede estar vacía.' },
        { status: 400 },
      );
    }

    let consentPayload:
      | {
          patientName?: string;
          replace?: boolean;
          pdf?: { buffer: Buffer; mimeType: string; fileName: string | null | undefined };
          signature?: { buffer: Buffer; mimeType: string };
        }
      | undefined;

    if (consentReplace && consentPatientName) {
      const [pdfBuffer, signatureBuffer] = await Promise.all([
        (consentFile as File).arrayBuffer().then((buffer) => Buffer.from(buffer)),
        (consentSignature as File).arrayBuffer().then((buffer) => Buffer.from(buffer)),
      ]);

      consentPayload = {
        replace: true,
        patientName: consentPatientName,
        pdf: {
          buffer: pdfBuffer,
          mimeType: (consentFile as File).type || 'application/pdf',
          fileName: (consentFile as File).name,
        },
        signature: {
          buffer: signatureBuffer,
          mimeType: (consentSignature as File).type || 'image/png',
        },
      };
    } else if (consentPatientName !== undefined) {
      consentPayload = {
        replace: false,
        patientName: consentPatientName,
      };
    }

    const treatment = await updateTreatment(user.id, id, {
      type,
      description,
      cost: costValue,
      date,
      consent: consentPayload,
    });

    return NextResponse.json({ success: true, treatment });
  } catch (error) {
    console.error('Error al actualizar tratamiento', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos actualizar el tratamiento' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const treatmentId = searchParams.get('treatmentId') ?? searchParams.get('id');

    if (!treatmentId) {
      return NextResponse.json({ error: 'Identificador de tratamiento inválido.' }, { status: 400 });
    }

    await deleteTreatment(user.id, treatmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar tratamiento', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos eliminar el tratamiento' },
      { status: 500 },
    );
  }
}
