import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  deleteOrthodonticPlan,
  listOrthodonticPlans,
  updateOrthodonticPlan,
} from '@/lib/db/supabase-repository';

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
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
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const monthlyFee = parseNumber(body?.monthlyFee ?? body?.cuota);
    const hasInitialFee = parseBoolean(body?.hasInitialFee ?? body?.tieneEntrega);
    const initialFee = parseNumber(body?.initialFee ?? body?.entregaInicial);

    if (name !== undefined && name.length === 0) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
    }

    if (monthlyFee !== undefined && monthlyFee < 0) {
      return NextResponse.json({ error: 'La cuota mensual debe ser positiva.' }, { status: 400 });
    }

    if (hasInitialFee === false) {
      // ignore provided initialFee when disabling it
    } else if (hasInitialFee === true && (initialFee === undefined || initialFee < 0)) {
      return NextResponse.json(
        { error: 'Debe indicar un valor válido para la entrega inicial.' },
        { status: 400 },
      );
    }

    const updated = await updateOrthodonticPlan(user.id, params.id, {
      name,
      monthlyFee,
      hasInitialFee,
      initialFee,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, plan: updated });
  } catch (error) {
    console.error('Error al actualizar plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar el plan de ortodoncia' },
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
    await deleteOrthodonticPlan(user.id, params.id);
    const plans = await listOrthodonticPlans(user.id);
    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('Error al eliminar plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos eliminar el plan de ortodoncia' },
      { status: 500 },
    );
  }
}
