import { google, calendar_v3 } from 'googleapis';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const delegatedAccount = process.env.GOOGLE_CALENDAR_DELEGATED_ACCOUNT;
const defaultCalendarId = process.env.GOOGLE_CALENDAR_DEFAULT_ID;
const defaultTimeZone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

function getPrivateKey() {
  if (!rawPrivateKey) {
    return undefined;
  }
  return rawPrivateKey.replace(/\\n/g, '\n');
}

function assertCalendarConfigured() {
  if (!serviceAccountEmail || !getPrivateKey()) {
    throw new Error(
      'Google Calendar no está configurado. Define GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.',
    );
  }
}

function buildAuth() {
  assertCalendarConfigured();
  return new google.auth.JWT({
    email: serviceAccountEmail,
    key: getPrivateKey(),
    scopes: CALENDAR_SCOPES,
    subject: delegatedAccount ?? undefined,
  });
}

function resolveCalendarId(explicitId?: string) {
  const id = explicitId ?? defaultCalendarId;
  if (!id) {
    throw new Error(
      'No se encontró un calendario de Google para sincronizar. Configura GOOGLE_CALENDAR_DEFAULT_ID o provee un correo de calendario válido.',
    );
  }
  return id;
}

function toEventDate(date: Date) {
  return {
    dateTime: date.toISOString(),
    timeZone: defaultTimeZone,
  } satisfies calendar_v3.Schema$EventDateTime;
}

export function isCalendarReady() {
  return Boolean(serviceAccountEmail && getPrivateKey());
}

export async function createCalendarEvent(params: {
  calendarId?: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: calendar_v3.Schema$EventAttendee[];
  location?: string;
}) {
  const calendarId = resolveCalendarId(params.calendarId);
  const auth = buildAuth();
  await auth.authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId,
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

  return response.data;
}

export async function updateCalendarEvent(params: {
  calendarId?: string;
  eventId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: calendar_v3.Schema$EventAttendee[];
  location?: string;
}) {
  const calendarId = resolveCalendarId(params.calendarId);
  const auth = buildAuth();
  await auth.authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.patch({
    calendarId,
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

  return response.data;
}

export async function deleteCalendarEvent(params: { calendarId?: string; eventId: string }) {
  const calendarId = resolveCalendarId(params.calendarId);
  const auth = buildAuth();
  await auth.authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId,
    eventId: params.eventId,
    sendUpdates: 'all',
  });
}
