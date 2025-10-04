import { google } from 'googleapis';
import { Credentials } from 'google-auth-library';

import type { OAuthTokenSet } from '@/lib/google/calendar';

// Google currently rejects the generative-language scope for regular OAuth clients, returning a
// 400 `invalid_scope` error. The cloud-platform scope still grants access to the Generative
// Language API when it is enabled on the project, so we rely on it alongside the standard profile
// scopes.
const GEMINI_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const DEFAULT_MODEL = process.env.GOOGLE_GEMINI_MODEL ?? 'models/gemini-1.5-flash-latest';
const API_BASE = process.env.GOOGLE_GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';

const explicitRedirectUri =
  process.env.GOOGLE_GEMINI_OAUTH_REDIRECT_URI ?? process.env.GOOGLE_OAUTH_REDIRECT_URI ?? null;

function resolveFallbackAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  );
}

function resolveClientId() {
  return (
    process.env.GOOGLE_GEMINI_CLIENT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_GEMINI_CLIENT_ID ??
    process.env.GEMINI_CLIENT_ID ??
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
    process.env.GOOGLE_GEMINI_CLIENT_SECRET ??
    process.env.NEXT_PUBLIC_GOOGLE_GEMINI_CLIENT_SECRET ??
    process.env.GEMINI_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET ??
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
    process.env.SUPABASE_GOOGLE_CLIENT_SECRET ??
    process.env.SUPABASE_AUTH_GOOGLE_CLIENT_SECRET ??
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET ??
    null
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
  return `${fallbackAppUrl.replace(/\/$/, '')}/api/google/gemini/callback`;
}

function assertGeminiConfigured() {
  const clientId = resolveClientId();
  const clientSecret = resolveClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Gemini OAuth no está configurado. Reutilizá GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET o definí sus equivalentes específicos de Gemini.',
    );
  }
  if (!resolveRedirectUri()) {
    throw new Error(
      'No encontramos un redirect URI para Google Gemini. Configurá GOOGLE_GEMINI_OAUTH_REDIRECT_URI, GOOGLE_OAUTH_REDIRECT_URI o NEXT_PUBLIC_APP_URL.',
    );
  }
}

export function isGeminiOAuthConfigured() {
  try {
    assertGeminiConfigured();
    return true;
  } catch {
    return false;
  }
}

export function buildGeminiOAuthClient() {
  assertGeminiConfigured();
  const clientId = resolveClientId();
  const clientSecret = resolveClientSecret();
  const redirectUri = resolveRedirectUri();
  return new google.auth.OAuth2(clientId!, clientSecret!, redirectUri);
}

export function generateGeminiOAuthUrl(state: string) {
  const client = buildGeminiOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: GEMINI_SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
    state,
  });
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

async function ensureGeminiCredentials(tokens: OAuthTokenSet) {
  const client = buildGeminiOAuthClient();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    scope: tokens.scope ?? undefined,
    token_type: tokens.tokenType ?? undefined,
    expiry_date: tokens.expiryDate ? new Date(tokens.expiryDate).getTime() : undefined,
  });

  let latestCredentials: OAuthTokenSet = { ...tokens };
  const needsRefresh =
    !tokens.expiryDate || new Date(tokens.expiryDate).getTime() - 60_000 <= Date.now();

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

  return { authClient: client, latestCredentials };
}

export async function fetchGeminiProfile(tokens: OAuthTokenSet) {
  const { authClient, latestCredentials } = await ensureGeminiCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
  const { data } = await oauth2.userinfo.get();
  return { profile: data, latestCredentials };
}

export async function exchangeGeminiCode(code: string) {
  const client = buildGeminiOAuthClient();
  const { tokens } = await client.getToken(code);
  const normalized = normalizeCredentials(tokens, {
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token ?? '',
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });
  return normalized;
}

export async function generateGeminiContent(
  tokens: OAuthTokenSet,
  prompt: string,
  options: { model?: string; temperature?: number } = {},
) {
  const { latestCredentials } = await ensureGeminiCredentials(tokens);
  const accessToken = latestCredentials.accessToken;
  if (!accessToken) {
    throw new Error('Gemini no devolvió un access token válido.');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.4;
  const endpoint = `${API_BASE}/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Gemini devolvió un error ${response.status}: ${errorPayload}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  return { text, latestCredentials, model };
}
