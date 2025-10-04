import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalGeminiCredentials } from '@/lib/db/supabase-repository';
import { isGeminiOAuthConfigured } from '@/lib/google/gemini';
import { planSupportsCapability } from '@/lib/utils/subscription';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo los profesionales pueden consultar Gemini.' }, { status: 403 });
  }

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      {
        connected: false,
        email: null,
        updatedAt: null,
        expiresAt: null,
        model: process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest',
        usingOwnerCredentials: true,
      },
      { status: 200 },
    );
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json(
      {
        connected: false,
        email: null,
        updatedAt: null,
        expiresAt: null,
        model: process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest',
        usingOwnerCredentials: false,
      },
      { status: 200 },
    );
  }

  if (!isGeminiOAuthConfigured()) {
    return NextResponse.json(
      {
        connected: false,
        email: null,
        updatedAt: null,
        expiresAt: null,
        model: process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest',
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
        email: null,
        updatedAt: null,
        expiresAt: null,
        model: process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest',
        usingOwnerCredentials: false,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    connected: true,
    email: credentials.email,
    updatedAt: credentials.updatedAt ?? null,
    expiresAt: credentials.expiryDate ?? null,
    model: process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest',
    usingOwnerCredentials: false,
  });
}
