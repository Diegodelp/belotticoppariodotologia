import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { signEphemeralToken } from '@/lib/auth/jwt';
import { generateGeminiOAuthUrl, isGeminiOAuthConfigured } from '@/lib/google/gemini';
import { planSupportsCapability } from '@/lib/utils/subscription';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional' || user.ownerProfessionalId) {
    return NextResponse.json({ error: 'Solo el titular del consultorio puede conectar Gemini.' }, { status: 403 });
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json(
      { error: 'El plan actual no incluye insights de IA. Actualizá a Pro para habilitar Gemini.' },
      { status: 403 },
    );
  }

  if (!isGeminiOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google Gemini no está configurado. Reutilizá las credenciales de Google Calendar (GOOGLE_CLIENT_ID/SECRET y el redirect) o definí las variables específicas de Gemini.',
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect') ?? '/settings';
  const state = signEphemeralToken({ userId: user.id, redirect }, '10m');
  const url = generateGeminiOAuthUrl(state);

  return NextResponse.json({ url });
}
