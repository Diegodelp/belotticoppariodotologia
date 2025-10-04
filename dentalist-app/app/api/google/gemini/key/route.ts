import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { upsertProfessionalGeminiCredentials } from '@/lib/db/supabase-repository';
import { planSupportsCapability } from '@/lib/utils/subscription';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional' || user.ownerProfessionalId) {
    return NextResponse.json({ error: 'Solo el titular puede configurar Gemini.' }, { status: 403 });
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json({ error: 'El plan actual no incluye automatizaciones con Gemini.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Debés enviar un cuerpo JSON con la API key.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'El cuerpo de la solicitud es inválido.' }, { status: 400 });
  }

  const { apiKey, label } = payload as { apiKey?: unknown; label?: unknown };
  const sanitizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (!sanitizedKey) {
    return NextResponse.json({ error: 'Ingresá la API key generada en Google AI Studio.' }, { status: 400 });
  }

  const sanitizedLabel = typeof label === 'string' && label.trim().length > 0 ? label.trim() : null;

  try {
    await upsertProfessionalGeminiCredentials(user.id, { apiKey: sanitizedKey, label: sanitizedLabel });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al guardar la API key de Gemini', error);
    return NextResponse.json(
      { error: 'No pudimos guardar la API key. Verificá tu configuración e intentá nuevamente.' },
      { status: 500 },
    );
  }
}
