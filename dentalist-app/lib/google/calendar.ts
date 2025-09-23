import { google, calendar_v3 } from 'googleapis';
import { Credentials } from 'google-auth-library';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const explicitRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
const defaultTimeZone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

function resolveClientId() {
  return (
    process.env.GOOGLE_CLIENT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_OAUTH_CLIENT_ID ??
    process.env.SUPABASE_GOOGLE_CLIENT_ID ??
    process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID ??
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ??
    null
  );
}

function resolveClientSecret() {
  return (
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET ??
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
    process.env.SUPABASE_GOOGLE_CLIENT_SECRET ??
    process.env.SUPABASE_AUTH_GOOGLE_CLIENT_SECRET ??
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET ??
    null
  );
}

function resolveFallbackAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  );
}

function resolveRedirectUri() {
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }
  const fallbackAppUrl = resolveFallbackAppUrl();
  if (!fallbackAppUrl) {
    return undefined;
  }
  return `${fallbackAppUrl.replace(/\/$/, '')}/api/google/oauth/callback`;
}

function assertOAuthConfigured() {
  const clientId = resolveClientId();
  const clientSecret = resolveClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth no está configurado. Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (o sus equivalentes NEXT_PUBLIC_/SUPABASE_) en las variables de entorno.',
    );
  }
  if (!resolveRedirectUri()) {
    throw new Error(
      'No encontramos un redirect URI para Google OAuth. Configurá GOOGLE_OAUTH_REDIRECT_URI, NEXT_PUBLIC_APP_URL o SITE_URL.',
    );
  }
}

export function isCalendarReady() {
  try {
    assertOAuthConfigured();
    return true;
  } catch {
    return false;
  }
}

export function buildOAuthClient() {
  assertOAuthConfigured();
  const clientId = resolveClientId();
  const clientSecret = resolveClientSecret();
  const redirectUri = resolveRedirectUri();
  return new google.auth.OAuth2(clientId!, clientSecret!, redirectUri);
}

export function generateOAuthUrl(state: string) {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: CALENDAR_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state,
  });
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  scope: string | null;
  tokenType: string | null;
  expiryDate: string | null;
}

function normalizeCredentials(tokens: Credentials, fallback: OAuthTokenSet): OAuthTokenSet {
  const expiryMillis =
    typeof tokens.expiry_date === 'number'
      ? tokens.expiry_date
      : fallback.expiryDate
      ? new Date(fallback.expiryDate).getTime()
      : undefined;

  return {
    accessToken: tokens.access_token ?? fallback.accessToken,
    refreshToken: tokens.refresh_token ?? fallback.refreshToken,
    scope: tokens.scope ?? fallback.scope,
    tokenType: tokens.token_type ?? fallback.tokenType,
    expiryDate: typeof expiryMillis === 'number' ? new Date(expiryMillis).toISOString() : null,
  };
}

async function ensureAuthorizedCalendar(tokens: OAuthTokenSet) {
  const client = buildOAuthClient();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    scope: tokens.scope ?? undefined,
    token_type: tokens.tokenType ?? undefined,
    expiry_date: tokens.expiryDate ? new Date(tokens.expiryDate).getTime() : undefined,
  });

  const needsRefresh = !tokens.expiryDate
    || new Date(tokens.expiryDate).getTime() - 60_000 <= Date.now();

  let latestCredentials: OAuthTokenSet = { ...tokens };

  if (needsRefresh) {
    const refreshed = await client.refreshAccessToken();
    latestCredentials = normalizeCredentials(refreshed.credentials, tokens);
    client.setCredentials({
      access_token: latestCredentials.accessToken,
      refresh_token: latestCredentials.refreshToken,
      scope: latestCredentials.scope ?? undefined,
      token_type: latestCredentials.tokenType ?? undefined,
      expiry_date: latestCredentials.expiryDate
        ? new Date(latestCredentials.expiryDate).getTime()
        : undefined,
    });
  }

  const calendar = google.calendar({ version: 'v3', auth: client });

  return {
    calendar,
    authClient: client,
    latestCredentials,
  };
}

function toEventDate(date: Date) {
  return {
    dateTime: date.toISOString(),
    timeZone: defaultTimeZone,
  } satisfies calendar_v3.Schema$EventDateTime;
}

export async function createCalendarEvent(
  tokens: OAuthTokenSet,
  params: {
    calendarId?: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: calendar_v3.Schema$EventAttendee[];
    location?: string;
  },
) {
  const { calendar, latestCredentials } = await ensureAuthorizedCalendar(tokens);
  const response = await calendar.events.insert({
    calendarId: params.calendarId ?? 'primary',
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: toEventDate(params.start),
      end: toEventDate(params.end),
      attendees: params.attendees,
      location: params.location,
    },
    sendUpdates: 'all',
  });

  return { event: response.data, latestCredentials };
}

export async function updateCalendarEvent(
  tokens: OAuthTokenSet,
  params: {
    calendarId?: string;
    eventId: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: calendar_v3.Schema$EventAttendee[];
    location?: string;
  },
) {
  const { calendar, latestCredentials } = await ensureAuthorizedCalendar(tokens);
  const response = await calendar.events.patch({
    calendarId: params.calendarId ?? 'primary',
    eventId: params.eventId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: toEventDate(params.start),
      end: toEventDate(params.end),
      attendees: params.attendees,
      location: params.location,
    },
    sendUpdates: 'all',
  });

  return { event: response.data, latestCredentials };
}

export async function deleteCalendarEvent(
  tokens: OAuthTokenSet,
  params: { calendarId?: string; eventId: string },
) {
  const { calendar, latestCredentials } = await ensureAuthorizedCalendar(tokens);
  await calendar.events.delete({
    calendarId: params.calendarId ?? 'primary',
    eventId: params.eventId,
    sendUpdates: 'all',
  });

  return { latestCredentials };
}

export async function fetchGoogleProfile(tokens: OAuthTokenSet) {
  const { authClient, latestCredentials } = await ensureAuthorizedCalendar(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
  const { data } = await oauth2.userinfo.get();
  return { profile: data, latestCredentials };
}
