import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalGoogleCredentials } from '@/lib/db/supabase-repository';
import { isCalendarReady } from '@/lib/google/calendar';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const credentials = await getProfessionalGoogleCredentials(user.id);

  return NextResponse.json({
    configured: isCalendarReady(),
    connected: Boolean(credentials),
    email: credentials?.email ?? null,
    calendarId: credentials?.calendarId ?? 'primary',
    expiresAt: credentials?.expiryDate ?? null,
  });
}
