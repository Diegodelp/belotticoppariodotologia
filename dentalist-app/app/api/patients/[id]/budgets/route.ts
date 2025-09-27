import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createBudgetRecord,
  deleteBudgetRecord,
  getPatientById,
  getProfessionalProfile,
  listBudgets,
  updateBudgetRecord,
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
  'urgencia',
  'regeneracionTisular',
  'otro',
];

type NormalizedBudgetItem = {
  practice: BudgetPractice;
  description?: string;
  amount: number;
};

function parseBudgetPayload(body: unknown): {
  title: string;
  notes?: string;
  items: NormalizedBudgetItem[];
} {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rawTitle = typeof record.title === 'string' ? record.title.trim() : '';

  if (!rawTitle) {
    throw new Error('El título del presupuesto es obligatorio.');
  }

  const notes = typeof record.notes === 'string' ? record.notes.trim() : undefined;
  const rawItems = Array.isArray(record.items) ? (record.items as unknown[]) : [];

  const items = rawItems
    .map((rawItem) => {
      const item = typeof rawItem === 'object' && rawItem !== null ? (rawItem as Record<string, unknown>) : {};
      const practiceValue = typeof item.practice === 'string' ? item.practice : undefined;
      const practice: BudgetPractice | undefined =
        practiceValue && PRACTICES.includes(practiceValue as BudgetPractice)
          ? (practiceValue as BudgetPractice)
          : undefined;
      const description = typeof item.description === 'string' ? item.description.trim() : undefined;
      const amount = Number(item.amount ?? 0);

      if (!practice || Number.isNaN(amount) || amount < 0) {
        return null;
      }

      const normalized: NormalizedBudgetItem = {
        practice,
        amount,
      };

      if (description) {
        normalized.description = description;
      }

      return normalized;
    })
    .filter((item): item is NormalizedBudgetItem => item !== null);

  if (items.length === 0) {
    throw new Error('Debes añadir al menos una práctica con un importe válido.');
  }

  return { title: rawTitle, notes, items };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const body = await request.json();

    let parsed;
    try {
      parsed = parseBudgetPayload(body);
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Datos inválidos.' },
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
      title: parsed.title,
      notes: parsed.notes,
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
      items: parsed.items,
    });

    const budget = await createBudgetRecord(user.id, patient.id, {
      budget: {
        title: parsed.title,
        notes: parsed.notes,
        items: parsed.items,
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

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const budgetId = url.searchParams.get('budgetId');

  if (!budgetId) {
    return NextResponse.json({ error: 'Identificador de presupuesto inválido.' }, { status: 400 });
  }

  try {
    const params = await context.params;
    const body = await request.json();

    let parsed;
    try {
      parsed = parseBudgetPayload(body);
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Datos inválidos.' },
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
      title: parsed.title,
      notes: parsed.notes,
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
      items: parsed.items,
    });

    const budget = await updateBudgetRecord(user.id, patient.id, budgetId, {
      budget: {
        title: parsed.title,
        notes: parsed.notes,
        items: parsed.items,
      },
      pdfBuffer,
    });

    return NextResponse.json({ success: true, budget });
  } catch (error) {
    console.error('Error al actualizar presupuesto', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar el presupuesto' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const budgetId = url.searchParams.get('budgetId');

  if (!budgetId) {
    return NextResponse.json({ error: 'Identificador de presupuesto inválido.' }, { status: 400 });
  }

  try {
    const params = await context.params;
    await deleteBudgetRecord(user.id, params.id, budgetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar presupuesto', error);
    return NextResponse.json(
      { error: 'No pudimos eliminar el presupuesto' },
      { status: 500 },
    );
  }
}
