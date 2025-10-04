import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { deleteProfessionalGeminiCredentials } from '@/lib/db/supabase-repository';
import { planSupportsCapability } from '@/lib/utils/subscription';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional' || user.ownerProfessionalId) {
    return NextResponse.json({ error: 'Solo el titular puede desconectar Gemini.' }, { status: 403 });
  }

  if (!planSupportsCapability(user.subscriptionPlan ?? null, 'aiInsights')) {
    return NextResponse.json({ error: 'El plan actual no incluye Gemini.' }, { status: 403 });
  }

  await deleteProfessionalGeminiCredentials(user.id);
  return NextResponse.json({ success: true });
}
