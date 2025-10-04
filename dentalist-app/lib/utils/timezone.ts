import type { Appointment } from '@/types';

const FALLBACK_TIME_ZONE = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return FALLBACK_TIME_ZONE;
  }
  const trimmed = timeZone.trim();
  if (!trimmed) {
    return FALLBACK_TIME_ZONE;
  }
  return isValidTimeZone(trimmed) ? trimmed : FALLBACK_TIME_ZONE;
}

export function getSupportedTimeZones(): string[] {
  if (typeof (Intl as unknown as { supportedValuesOf?: (input: string) => string[] }).supportedValuesOf === 'function') {
    return ((Intl as unknown as { supportedValuesOf: (input: 'timeZone') => string[] }).supportedValuesOf('timeZone')).slice();
  }

  return [
    'America/Argentina/Buenos_Aires',
    'America/Montevideo',
    'America/Sao_Paulo',
    'America/Santiago',
    'America/Lima',
    'America/Mexico_City',
    'America/Bogota',
    'Europe/Madrid',
  ];
}

function extractParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '0';
  const year = Number(lookup('year'));
  const month = Number(lookup('month'));
  const day = Number(lookup('day'));
  const hour = Number(lookup('hour'));
  const minute = Number(lookup('minute'));
  const second = Number(lookup('second'));

  return { year, month, day, hour, minute, second };
}

export function parseDateTimeInTimeZone(date: string, time: string, timeZone: string): Date {
  const normalizedZone = normalizeTimeZone(timeZone);
  const [year, month, day] = date.split('-').map((value) => Number.parseInt(value, 10));
  const [hour, minute] = time.split(':').map((value) => Number.parseInt(value, 10));
  const baseline = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0));
  const actual = extractParts(baseline, normalizedZone);
  const diffMinutes = (hour - actual.hour) * 60 + (minute - actual.minute);
  return new Date(baseline.getTime() + diffMinutes * 60_000);
}

export function formatDateTimeInTimeZone(input: string | Date, timeZone: string) {
  const normalizedZone = normalizeTimeZone(timeZone);
  const value = typeof input === 'string' ? new Date(input) : new Date(input.getTime());
  if (Number.isNaN(value.getTime())) {
    return { date: '', time: '' };
  }

  const { year, month, day, hour, minute } = extractParts(value, normalizedZone);
  const pad = (num: number) => num.toString().padStart(2, '0');
  return {
    date: `${year.toString().padStart(4, '0')}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

export const DEFAULT_TIME_ZONE = FALLBACK_TIME_ZONE;

export function formatAppointmentForTimeZone<T extends Appointment>(appointment: T, timeZone: string): T {
  if (!appointment.startAt) {
    return appointment;
  }
  const normalizedZone = normalizeTimeZone(timeZone);
  const formatted = formatDateTimeInTimeZone(appointment.startAt, normalizedZone);
  return {
    ...appointment,
    date: formatted.date || appointment.date,
    time: formatted.time || appointment.time,
    startAt: new Date(appointment.startAt).toISOString(),
    endAt: appointment.endAt ? new Date(appointment.endAt).toISOString() : appointment.endAt,
  };
}

export function formatAppointmentsForTimeZone<T extends Appointment>(appointments: T[], timeZone: string): T[] {
  return appointments.map((appointment) => formatAppointmentForTimeZone(appointment, timeZone));
}
