import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { signEphemeralToken } from '@/lib/auth/jwt';
import { generateOAuthUrl, isCalendarReady } from '@/lib/google/calendar';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isCalendarReady()) {
    return NextResponse.json(
      {
        error:
          'Google OAuth no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_OAUTH_REDIRECT_URI.',
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect') ?? '/settings';

  const state = signEphemeralToken({ userId: user.id, redirect }, '10m');
  const url = generateOAuthUrl(state);

  return NextResponse.json({ url });
}
