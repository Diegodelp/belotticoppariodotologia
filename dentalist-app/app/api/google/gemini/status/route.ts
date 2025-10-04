import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalGeminiCredentials } from '@/lib/db/supabase-repository';
import { getDefaultGeminiModel } from '@/lib/google/gemini';
import { planSupportsCapability } from '@/lib/utils/subscription';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo los profesionales pueden consultar Gemini.' }, { status: 403 });
  }

  const model = getDefaultGeminiModel();

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      {
        connected: false,
        updatedAt: null,
        lastUsedAt: null,
        label: null,
        model,
        usingOwnerCredentials: true,
      },
      { status: 200 },
    );
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json(
      {
        connected: false,
        updatedAt: null,
        lastUsedAt: null,
        label: null,
        model,
        usingOwnerCredentials: false,
      },
      { status: 200 },
    );
  }

  const credentials = await getProfessionalGeminiCredentials(user.id);
  if (!credentials) {
    return NextResponse.json(
      {
        connected: false,
        updatedAt: null,
        lastUsedAt: null,
        label: null,
        model,
        usingOwnerCredentials: false,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    connected: true,
    updatedAt: credentials.updatedAt ?? null,
    lastUsedAt: credentials.lastUsedAt ?? null,
    label: credentials.label ?? null,
    model,
    usingOwnerCredentials: false,
  });
}
