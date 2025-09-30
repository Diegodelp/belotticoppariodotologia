import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getBudgetById,
  getPatientById,
  getProfessionalProfile,
} from '@/lib/db/supabase-repository';
import { sendBudgetIssuedEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const params = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const budgetId = typeof body === 'object' && body && 'budgetId' in body
    ? String((body as { budgetId?: string }).budgetId ?? '').trim()
    : '';

  if (!budgetId) {
    return NextResponse.json(
      { error: 'Falta el identificador del presupuesto a enviar.' },
      { status: 400 },
    );
  }

  try {
    const [patient, budget, professional] = await Promise.all([
      getPatientById(user.id, params.id),
      getBudgetById(user.id, params.id, budgetId),
      getProfessionalProfile(user.id),
    ]);

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    if (!budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    if (!professional) {
      return NextResponse.json(
        { error: 'No pudimos obtener los datos del profesional para enviar el presupuesto.' },
        { status: 400 },
      );
    }

    if (!patient.email) {
      return NextResponse.json(
        { error: 'El paciente no tiene un correo electrónico registrado.' },
        { status: 400 },
      );
    }

    if (!budget.documentUrl) {
      return NextResponse.json(
        {
          error:
            'El presupuesto no tiene un documento disponible. Regeneralo para obtener un enlace de descarga.',
        },
        { status: 409 },
      );
    }

    await sendBudgetIssuedEmail({
      to: patient.email,
      patientName: `${patient.name} ${patient.lastName}`.trim(),
      professionalName: professional.fullName ?? user.name,
      budgetTitle: budget.title,
      totalAmount: budget.total,
      documentUrl: budget.documentUrl,
      clinicName: professional.clinicName ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al enviar presupuesto por correo', error);
    return NextResponse.json(
      { error: 'No pudimos enviar el presupuesto en este momento. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
