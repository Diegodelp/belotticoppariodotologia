import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createBudgetRecord,
  getPatientById,
  getProfessionalProfile,
  listBudgets,
} from '@/lib/db/supabase-repository';
import { generateBudgetPdf } from '@/lib/documents/budget-pdf';
import { BudgetPractice } from '@/types';

const PRACTICES: BudgetPractice[] = [
  'operatoria',
  'exodoncia',
  'limpieza',
  'blanqueamiento',
  'implante',
  'corona',
  'carilla',
  'perno',
  'endodoncia',
];

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
    const budgets = await listBudgets(user.id, params.id);
    return NextResponse.json({ budgets });
  } catch (error) {
    console.error('Error al listar presupuestos', error);
    return NextResponse.json(
      { error: 'No pudimos cargar los presupuestos del paciente' },
      { status: 500 },
    );
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

  try {
    const params = await context.params;
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : undefined;
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (!title) {
      return NextResponse.json({ error: 'El título del presupuesto es obligatorio.' }, { status: 400 });
    }

    type RawBudgetItem = {
      practice?: unknown;
      description?: unknown;
      amount?: unknown;
    };

    type NormalizedBudgetItem = {
      practice: BudgetPractice;
      description?: string;
      amount: number;
    };

    const items = (rawItems as RawBudgetItem[])
      .map<NormalizedBudgetItem | null>((item) => {
        const practiceValue = typeof item.practice === 'string' ? item.practice : undefined;
        const practice: BudgetPractice | undefined = practiceValue && PRACTICES.includes(practiceValue as BudgetPractice)
          ? (practiceValue as BudgetPractice)
          : undefined;
        const description = typeof item.description === 'string' ? item.description.trim() : undefined;
        const amount = Number(item.amount ?? 0);
        return practice && !Number.isNaN(amount) && amount >= 0
          ? { practice, description, amount }
          : null;
      })
      .filter((item): item is NormalizedBudgetItem => item !== null);

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Debes añadir al menos una práctica con un importe válido.' },
        { status: 400 },
      );
    }

    const [patient, professional] = await Promise.all([
      getPatientById(user.id, params.id),
      getProfessionalProfile(user.id),
    ]);

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    if (!professional) {
      return NextResponse.json(
        { error: 'No pudimos obtener los datos del profesional para generar el presupuesto.' },
        { status: 400 },
      );
    }

    const pdfBuffer = generateBudgetPdf({
      title,
      notes,
      issuedAt: new Date(),
      professional: {
        name: professional.fullName ?? '',
        clinicName: professional.clinicName ?? undefined,
        licenseNumber: professional.licenseNumber ?? undefined,
        phone: professional.phone ?? undefined,
        email: professional.email ?? undefined,
      },
      patient: {
        name: `${patient.name} ${patient.lastName}`.trim(),
        dni: patient.dni,
        healthInsurance: patient.healthInsurance,
        affiliateNumber: patient.affiliateNumber,
      },
      items,
    });

    const budget = await createBudgetRecord(user.id, patient.id, {
      budget: {
        title,
        notes,
        items,
      },
      pdfBuffer,
    });

    return NextResponse.json({ success: true, budget });
  } catch (error) {
    console.error('Error al crear presupuesto', error);
    return NextResponse.json(
      { error: 'No pudimos crear el presupuesto' },
      { status: 500 },
    );
  }
}
