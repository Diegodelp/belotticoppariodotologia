import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { createOrthodonticPlan, listOrthodonticPlans } from '@/lib/db/supabase-repository';

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const plans = await listOrthodonticPlans(user.id);
    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error al listar planes de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos cargar los planes de ortodoncia' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const monthlyFee = Number(body?.monthlyFee ?? body?.cuota ?? 0);
    const hasInitialFee = parseBoolean(body?.hasInitialFee ?? body?.tieneEntrega, false);
    const initialFeeRaw = body?.initialFee ?? body?.entregaInicial;
    const initialFee =
      initialFeeRaw === undefined || initialFeeRaw === null ? null : Number(initialFeeRaw);

    if (!name) {
      return NextResponse.json({ error: 'El nombre del plan es obligatorio.' }, { status: 400 });
    }

    if (Number.isNaN(monthlyFee) || monthlyFee < 0) {
      return NextResponse.json({ error: 'La cuota mensual debe ser un número válido.' }, { status: 400 });
    }

    if (hasInitialFee && (initialFee === null || Number.isNaN(initialFee) || initialFee < 0)) {
      return NextResponse.json({ error: 'El valor de la entrega inicial debe ser un número válido.' }, { status: 400 });
    }

    const plan = await createOrthodonticPlan(user.id, {
      name,
      monthlyFee,
      hasInitialFee,
      initialFee: hasInitialFee ? initialFee ?? 0 : null,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Error al crear plan de ortodoncia', error);
    return NextResponse.json(
      { error: 'No pudimos crear el plan de ortodoncia' },
      { status: 500 },
    );
  }
}
