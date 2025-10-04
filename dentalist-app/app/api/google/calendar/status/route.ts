import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalGoogleCredentials, getProfessionalProfile } from '@/lib/db/supabase-repository';
import { isCalendarReady } from '@/lib/google/calendar';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const [credentials, ownerProfile] = await Promise.all([
    getProfessionalGoogleCredentials(ownerProfessionalId),
    getProfessionalProfile(ownerProfessionalId).catch(() => null),
  ]);

  return NextResponse.json({
    configured: isCalendarReady(),
    connected: Boolean(credentials),
    email: credentials?.email ?? null,
    calendarId: credentials?.calendarId ?? 'primary',
    expiresAt: credentials?.expiryDate ?? null,
    usingOwnerCredentials: Boolean(user.ownerProfessionalId),
    ownerName: ownerProfile?.fullName ?? ownerProfile?.clinicName ?? null,
  });
}
