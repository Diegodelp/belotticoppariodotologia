import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  deleteAppointment,
  getClinicByIdForOwner,
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

    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
    const clinicScope = user.ownerProfessionalId && user.teamRole !== 'admin' ? user.teamClinicId ?? null : null;
    const profile = await getProfessionalProfile(ownerProfessionalId);
    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const body = await request.json();
    const params = await context.params;
    const current = await getAppointmentById(ownerProfessionalId, params.id);

    if (!current) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    const zonedCurrent = formatAppointmentForTimeZone(current, timeZone);
    const { status, type, date, time, patientId } = body ?? {};
    const requestedClinicId = typeof body?.clinicId === 'string' ? body.clinicId.trim() : '';

    const nextPatientId =
      typeof patientId === 'string' && patientId.length > 0 ? patientId : zonedCurrent.patientId ?? undefined;
    const nextPatient = nextPatientId ? await getPatientById(ownerProfessionalId, nextPatientId) : null;

    if (patientId && nextPatientId && !nextPatient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    let selectedClinic: Awaited<ReturnType<typeof getClinicByIdForOwner>> | null = null;

    if (requestedClinicId) {
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, requestedClinicId);
      if (!clinic) {
        return NextResponse.json({ error: 'El consultorio seleccionado no existe.' }, { status: 404 });
      }
      selectedClinic = clinic;
    }

    if (clinicScope) {
      const guardClinicId = selectedClinic?.id ?? nextPatient?.clinicId ?? zonedCurrent.clinicId ?? null;
      if (guardClinicId && guardClinicId !== clinicScope) {
        return NextResponse.json(
          { error: 'No tenés permisos para gestionar turnos de ese consultorio.' },
          { status: 403 },
        );
      }
    }

    if (selectedClinic && nextPatient?.clinicId && nextPatient.clinicId !== selectedClinic.id) {
      return NextResponse.json(
        {
          error:
            'El paciente está asignado a otro consultorio. Actualizá la ficha antes de mover el turno a una sede diferente.',
        },
        { status: 409 },
      );
    }

    const credentials = await getProfessionalGoogleCredentials(ownerProfessionalId);
    const fallbackCalendarId = credentials?.calendarId ?? 'primary';
    let targetCalendarId = zonedCurrent.calendarId ?? fallbackCalendarId;
    let targetClinicId: string | null = zonedCurrent.clinicId ?? null;

    if (selectedClinic) {
      targetClinicId = selectedClinic.id;
      targetCalendarId = selectedClinic.calendarId ?? fallbackCalendarId;
    } else if (nextPatient?.clinicId) {
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, nextPatient.clinicId);
      targetClinicId = clinic?.id ?? nextPatient.clinicId;
      targetCalendarId = clinic?.calendarId ?? fallbackCalendarId;
    } else if (!nextPatient?.clinicId) {
      targetClinicId = null;
      targetCalendarId = fallbackCalendarId;
    }

    const updated = await updateAppointment(
      ownerProfessionalId,
      params.id,
      {
        status,
        type,
        date,
        time,
        patientId: nextPatientId,
        calendarId: targetCalendarId,
        clinicId: targetClinicId,
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

    if (!isCalendarReady() || !credentials) {
      await updateAppointment(
        ownerProfessionalId,
        params.id,
        {
          status: zonedCurrent.status,
          type: zonedCurrent.type,
          date: zonedCurrent.date,
          time: zonedCurrent.time,
          patientId: zonedCurrent.patientId,
          calendarId: zonedCurrent.calendarId ?? null,
          clinicId: zonedCurrent.clinicId ?? null,
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
      const patient = zonedUpdated.patientId
        ? await getPatientById(ownerProfessionalId, zonedUpdated.patientId)
        : null;
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
        calendarId: zonedUpdated.calendarId ?? fallbackCalendarId,
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
        await upsertProfessionalGoogleCredentials(ownerProfessionalId, {
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
        ownerProfessionalId,
        params.id,
        {
          status: zonedCurrent.status,
          type: zonedCurrent.type,
          date: zonedCurrent.date,
          time: zonedCurrent.time,
          patientId: zonedCurrent.patientId,
          calendarId: zonedCurrent.calendarId ?? null,
          clinicId: zonedCurrent.clinicId ?? null,
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
  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const clinicScope = user.ownerProfessionalId && user.teamRole !== 'admin' ? user.teamClinicId ?? null : null;
  const params = await context.params;

  if (clinicScope) {
    const current = await getAppointmentById(ownerProfessionalId, params.id);
    if (!current) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }
    if (current.patientId) {
      const patient = await getPatientById(ownerProfessionalId, current.patientId);
      if (patient && patient.clinicId !== clinicScope) {
        return NextResponse.json(
          { error: 'No tenés permisos para gestionar turnos de ese consultorio.' },
          { status: 403 },
        );
      }
      if (!patient && current.clinicId && current.clinicId !== clinicScope) {
        return NextResponse.json(
          { error: 'No tenés permisos para gestionar turnos de ese consultorio.' },
          { status: 403 },
        );
      }
    } else if (current.clinicId && current.clinicId !== clinicScope) {
      return NextResponse.json(
        { error: 'No tenés permisos para gestionar turnos de ese consultorio.' },
        { status: 403 },
      );
    }
  }

  const deleted = await deleteAppointment(ownerProfessionalId, params.id);

  if (!deleted) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  if (deleted.googleEventId && isCalendarReady()) {
    try {
      const credentials = await getProfessionalGoogleCredentials(ownerProfessionalId);

      if (credentials) {
        const tokenSet: OAuthTokenSet = {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          scope: credentials.scope,
          tokenType: credentials.tokenType,
          expiryDate: credentials.expiryDate,
        };

        const { latestCredentials } = await deleteCalendarEvent(tokenSet, {
          calendarId: deleted.calendarId ?? credentials.calendarId ?? undefined,
          eventId: deleted.googleEventId,
        });

        const credentialsChanged =
          latestCredentials.accessToken !== credentials.accessToken ||
          latestCredentials.refreshToken !== credentials.refreshToken ||
          latestCredentials.scope !== credentials.scope ||
          latestCredentials.tokenType !== credentials.tokenType ||
          latestCredentials.expiryDate !== credentials.expiryDate;

        if (credentialsChanged) {
          await upsertProfessionalGoogleCredentials(ownerProfessionalId, {
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
