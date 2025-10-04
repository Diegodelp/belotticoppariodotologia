import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { createPatientInvite } from '@/lib/db/supabase-repository';

const INVITE_EXPIRATION_MINUTES = 120;

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const expiresAt = new Date(Date.now() + INVITE_EXPIRATION_MINUTES * 60 * 1000);
    const { invite, token } = await createPatientInvite(user.id, expiresAt);

    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const inviteUrl = `${origin}/register?invite=${token}`;

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        usedAt: invite.usedAt,
        url: inviteUrl,
      },
      inviteUrl,
    });
  } catch (error) {
    console.error('Error al generar enlace de invitación', error);
    return NextResponse.json(
      { error: 'No pudimos generar el enlace de registro. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
