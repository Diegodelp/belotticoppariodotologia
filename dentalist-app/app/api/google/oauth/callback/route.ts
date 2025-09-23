import { NextRequest, NextResponse } from 'next/server';
import { verifyEphemeralToken } from '@/lib/auth/jwt';
import {
  buildOAuthClient,
  fetchGoogleProfile,
  isCalendarReady,
  OAuthTokenSet,
} from '@/lib/google/calendar';
import {
  getProfessionalGoogleCredentials,
  upsertProfessionalGoogleCredentials,
} from '@/lib/db/supabase-repository';

interface StatePayload {
  userId: string;
  redirect?: string;
}

function redirectWithStatus(request: NextRequest, redirectPath: string | undefined, status: string, message?: string) {
  const target = new URL(redirectPath ?? '/settings', request.nextUrl.origin);
  target.searchParams.set('calendar', status);
  if (message) {
    target.searchParams.set('message', message);
  }
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  if (!isCalendarReady()) {
    return NextResponse.json(
      {
        error:
          'Google OAuth no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_OAUTH_REDIRECT_URI.',
      },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (error) {
    return redirectWithStatus(request, undefined, 'error', error);
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  let payload: StatePayload;
  try {
    payload = verifyEphemeralToken<StatePayload>(state);
  } catch {
    return NextResponse.json({ error: 'Estado inválido o expirado' }, { status: 400 });
  }

  try {
    const oauthClient = buildOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const existing = await getProfessionalGoogleCredentials(payload.userId);

    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    const accessToken = tokens.access_token ?? existing?.accessToken;

    if (!refreshToken || !accessToken) {
      return redirectWithStatus(
        request,
        payload.redirect,
        'error',
        'Google no entregó los tokens necesarios. Vuelve a intentar autorizando el acceso.',
      );
    }

    const expiryDate =
      typeof tokens.expiry_date === 'number'
        ? new Date(tokens.expiry_date).toISOString()
        : existing?.expiryDate ?? null;

    const tokenSet: OAuthTokenSet = {
      accessToken,
      refreshToken,
      scope: tokens.scope ?? existing?.scope ?? null,
      tokenType: tokens.token_type ?? existing?.tokenType ?? null,
      expiryDate,
    };

    const { profile, latestCredentials } = await fetchGoogleProfile(tokenSet);

    const googleUserId = profile.id ?? profile.sub;
    const email = profile.email ?? existing?.email ?? null;

    if (!googleUserId || !email) {
      return redirectWithStatus(
        request,
        payload.redirect,
        'error',
        'No pudimos obtener el correo de la cuenta de Google autorizada.',
      );
    }

    await upsertProfessionalGoogleCredentials(payload.userId, {
      googleUserId,
      email,
      calendarId: existing?.calendarId ?? 'primary',
      accessToken: latestCredentials.accessToken,
      refreshToken: latestCredentials.refreshToken,
      scope: latestCredentials.scope,
      tokenType: latestCredentials.tokenType,
      expiryDate: latestCredentials.expiryDate,
    });

    return redirectWithStatus(request, payload.redirect, 'connected');
  } catch (oauthError) {
    console.error('Error al vincular Google Calendar', oauthError);
    return redirectWithStatus(
      request,
      payload.redirect,
      'error',
      'No pudimos vincular tu cuenta de Google Calendar. Intentalo nuevamente.',
    );
  }
}
