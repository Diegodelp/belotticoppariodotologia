import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  deleteAppointment,
  getAppointmentById,
  getPatientById,
  getProfessionalGoogleCredentials,
  getProfessionalProfile,
  updateAppointment,
  upsertProfessionalGoogleCredentials,
} from '@/lib/db/supabase-repository';
import {
  deleteCalendarEvent,
  isCalendarReady,
  OAuthTokenSet,
  updateCalendarEvent,
} from '@/lib/google/calendar';
import {
  DEFAULT_TIME_ZONE,
  formatAppointmentForTimeZone,
  normalizeTimeZone,
  parseDateTimeInTimeZone,
} from '@/lib/utils/timezone';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const profile = await getProfessionalProfile(user.id);
    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const body = await request.json();
    const params = await context.params;
    const current = await getAppointmentById(user.id, params.id);

    if (!current) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    const zonedCurrent = formatAppointmentForTimeZone(current, timeZone);

    const { status, type, date, time, patientId } = body ?? {};
    const updated = await updateAppointment(
      user.id,
      params.id,
      {
        status,
        type,
        date,
        time,
        patientId,
      },
      { timeZone },
    );

    if (!updated) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    const zonedUpdated = formatAppointmentForTimeZone(updated, timeZone);

    if (!zonedUpdated.googleEventId) {
      return NextResponse.json({ success: true, appointment: zonedUpdated });
    }

    const credentials = await getProfessionalGoogleCredentials(user.id);

    if (!isCalendarReady() || !credentials) {
      await updateAppointment(
        user.id,
        params.id,
        {
          status: zonedCurrent.status,
          type: zonedCurrent.type,
          date: zonedCurrent.date,
          time: zonedCurrent.time,
          patientId: zonedCurrent.patientId,
        },
        { timeZone },
      ).catch(() => undefined);
      return NextResponse.json(
        {
          error:
            'Conectá nuevamente tu cuenta de Google Calendar para sincronizar la reprogramación del turno.',
        },
        { status: 500 },
      );
    }

    try {
      const patient = zonedUpdated.patientId ? await getPatientById(user.id, zonedUpdated.patientId) : null;
      const start = zonedUpdated.startAt
        ? new Date(zonedUpdated.startAt)
        : parseDateTimeInTimeZone(zonedUpdated.date, zonedUpdated.time, timeZone);
      const end = zonedUpdated.endAt ? new Date(zonedUpdated.endAt) : new Date(start.getTime() + 60 * 60 * 1000);

      const tokenSet: OAuthTokenSet = {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        scope: credentials.scope,
        tokenType: credentials.tokenType,
        expiryDate: credentials.expiryDate,
      };

      const { latestCredentials } = await updateCalendarEvent(tokenSet, {
        calendarId: credentials.calendarId ?? undefined,
        eventId: zonedUpdated.googleEventId,
        summary: `${zonedUpdated.type} con ${patient ? `${patient.name} ${patient.lastName}` : 'paciente'}`,
        description: [
          patient ? `Paciente: ${patient.name} ${patient.lastName}` : null,
          patient?.dni ? `DNI: ${patient.dni}` : null,
          patient?.email ? `Email: ${patient.email}` : null,
          patient?.phone ? `Teléfono: ${patient.phone}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        start,
        end,
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
    } catch (calendarError) {
      console.error('Error al actualizar evento en Google Calendar', calendarError);
      await updateAppointment(
        user.id,
        params.id,
        {
          status: zonedCurrent.status,
          type: zonedCurrent.type,
          date: zonedCurrent.date,
          time: zonedCurrent.time,
          patientId: zonedCurrent.patientId,
        },
        { timeZone },
      ).catch(() => undefined);
      return NextResponse.json(
        {
          error:
            'No pudimos sincronizar el turno en Google Calendar. Intentalo nuevamente cuando la conexión esté disponible.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, appointment: zonedUpdated });
  } catch (error) {
    console.error('Error al actualizar turno', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar el turno' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const params = await context.params;
  const deleted = await deleteAppointment(user.id, params.id);

  if (!deleted) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  if (deleted.googleEventId && isCalendarReady()) {
    try {
      const credentials = await getProfessionalGoogleCredentials(user.id);

      if (credentials) {
        const tokenSet: OAuthTokenSet = {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          scope: credentials.scope,
          tokenType: credentials.tokenType,
          expiryDate: credentials.expiryDate,
        };

        const { latestCredentials } = await deleteCalendarEvent(tokenSet, {
          calendarId: credentials.calendarId ?? undefined,
          eventId: deleted.googleEventId,
        });

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
      }
    } catch (error) {
      console.error('No se pudo eliminar el evento en Google Calendar', error);
    }
  }

  return NextResponse.json({ success: true });
}
