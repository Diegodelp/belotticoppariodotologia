import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  attachAppointmentGoogleEvent,
  createAppointment,
  deleteAppointment,
  getPatientById,
  getProfessionalGoogleCredentials,
  getProfessionalProfile,
  listAppointments,
  listPatients,
  upsertProfessionalGoogleCredentials,
} from '@/lib/db/supabase-repository';
import { createCalendarEvent, isCalendarReady, OAuthTokenSet } from '@/lib/google/calendar';
import { Appointment, Patient } from '@/types';
import {
  DEFAULT_TIME_ZONE,
  formatAppointmentForTimeZone,
  formatAppointmentsForTimeZone,
  normalizeTimeZone,
  parseDateTimeInTimeZone,
} from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    const [profile, appointmentsRaw, patients] = await Promise.all([
      getProfessionalProfile(user.id),
      listAppointments(user.id, patientId ?? undefined),
      listPatients(user.id),
    ]);

    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const appointments = formatAppointmentsForTimeZone(appointmentsRaw, timeZone);

    const filtered = appointments.filter((appointment) => {
      const withinStatus = status ? appointment.status === status : true;
      const gteFrom = from ? appointment.date >= from : true;
      const lteTo = to ? appointment.date <= to : true;
      return withinStatus && gteFrom && lteTo;
    });

    const patientMap = new Map(patients.map((patient) => [patient.id, patient] as [string, Patient]));

    const withPatient = filtered.map((appointment) => ({
      ...appointment,
      patient: patientMap.get(appointment.patientId),
    }));

    return NextResponse.json(withPatient);
  } catch (error) {
    console.error('Error al listar turnos en Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener los turnos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const profile = await getProfessionalProfile(user.id);
    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const body = await request.json();
    const { patientId, date, time, type, status = 'pending' } = body ?? {};

    if (!patientId || !date || !time || !type) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    const startAt = parseDateTimeInTimeZone(date, time, timeZone);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    const appointment: Appointment = await createAppointment(user.id, {
      patientId,
      title: type,
      status,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    const credentials = await getProfessionalGoogleCredentials(user.id);

    if (!isCalendarReady() || !credentials) {
      await deleteAppointment(user.id, appointment.id);
      return NextResponse.json(
        {
          error:
            'Conectá tu cuenta de Google Calendar desde Configuración para poder sincronizar los turnos.',
        },
        { status: 400 },
      );
    }

    try {
      const patient = patientId ? await getPatientById(user.id, patientId) : null;
      const tokenSet: OAuthTokenSet = {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        scope: credentials.scope,
        tokenType: credentials.tokenType,
        expiryDate: credentials.expiryDate,
      };

      const { event, latestCredentials } = await createCalendarEvent(tokenSet, {
        calendarId: credentials.calendarId ?? undefined,
        summary: `${type} con ${patient ? `${patient.name} ${patient.lastName}` : 'paciente'}`,
        description: [
          patient ? `Paciente: ${patient.name} ${patient.lastName}` : null,
          patient?.dni ? `DNI: ${patient.dni}` : null,
          patient?.email ? `Email: ${patient.email}` : null,
          patient?.phone ? `Teléfono: ${patient.phone}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        start: startAt,
        end: endAt,
        timeZone,
        attendees:
          patient?.email
            ? [
                {
                  email: patient.email,
                  displayName: `${patient.name} ${patient.lastName}`.trim(),
                },
              ]
            : undefined,
      });

      if (!event.id) {
        throw new Error('La API de Google Calendar no devolvió un ID de evento.');
      }

      const credentialsChanged =
        latestCredentials.accessToken !== credentials.accessToken ||
        latestCredentials.refreshToken !== credentials.refreshToken ||
        latestCredentials.scope !== credentials.scope ||
        latestCredentials.tokenType !== credentials.tokenType ||
        latestCredentials.expiryDate !== credentials.expiryDate;

      if (credentialsChanged) {
        await upsertProfessionalGoogleCredentials(user.id, {
          googleUserId: credentials.googleUserId,
          email: credentials.email,
          calendarId: credentials.calendarId ?? 'primary',
          accessToken: latestCredentials.accessToken,
          refreshToken: latestCredentials.refreshToken,
          scope: latestCredentials.scope,
          tokenType: latestCredentials.tokenType,
          expiryDate: latestCredentials.expiryDate,
        });
      }

      const updated = await attachAppointmentGoogleEvent(user.id, appointment.id, event.id);
      const responseAppointment = formatAppointmentForTimeZone(updated ?? appointment, timeZone);

      return NextResponse.json({ success: true, appointment: responseAppointment });
    } catch (calendarError) {
      console.error('Error al crear evento en Google Calendar', calendarError);
      await deleteAppointment(user.id, appointment.id).catch(() => undefined);
      return NextResponse.json(
        {
          error:
            'No pudimos sincronizar el turno con Google Calendar. Verificá las credenciales y vuelve a intentarlo.',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('Error al crear turno', error);
    return NextResponse.json(
      { error: 'No pudimos agendar el turno' },
      { status: 500 },
    );
  }
}
