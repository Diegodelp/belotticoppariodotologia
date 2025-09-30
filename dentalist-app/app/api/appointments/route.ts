import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  attachAppointmentGoogleEvent,
  createAppointment,
  deleteAppointment,
  getClinicByIdForOwner,
  getPatientById,
  getProfessionalGoogleCredentials,
  getProfessionalProfile,
  listAppointments,
  listPatients,
  updateClinic,
  upsertProfessionalGoogleCredentials,
} from '@/lib/db/supabase-repository';
import { createCalendar, createCalendarEvent, isCalendarReady, OAuthTokenSet } from '@/lib/google/calendar';
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

  const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
  const clinicScope = user.ownerProfessionalId && user.teamRole !== 'admin' ? user.teamClinicId ?? null : null;

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    const [profile, appointmentsRaw, patients] = await Promise.all([
      getProfessionalProfile(ownerProfessionalId),
      listAppointments(ownerProfessionalId, patientId ?? undefined),
      listPatients(ownerProfessionalId),
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

    const withPatient = filtered
      .map((appointment) => ({
        ...appointment,
        patient: patientMap.get(appointment.patientId),
      }))
      .filter((appointment) => {
        if (!clinicScope) {
          return true;
        }
        const appointmentClinic = appointment.patient?.clinicId ?? appointment.clinicId ?? null;
        return appointmentClinic === clinicScope;
      });

    return NextResponse.json(withPatient);
  } catch (error) {
    console.error('Error al listar turnos en Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener los turnos' },
      { status: 500 },
    );
  }
}

function isCalendarNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const anyError = error as { code?: number; status?: number; response?: { status?: number; data?: unknown }; errors?: unknown };

  if (anyError.code === 404 || anyError.status === 404 || anyError.response?.status === 404) {
    return true;
  }

  const errorPayloads: unknown[] = [];

  if (Array.isArray((anyError as { errors?: unknown[] }).errors)) {
    errorPayloads.push(...((anyError as { errors?: unknown[] }).errors as unknown[]));
  }

  const responseData = anyError.response?.data as { error?: { errors?: unknown[] } } | undefined;
  if (Array.isArray(responseData?.error?.errors)) {
    errorPayloads.push(...(responseData?.error?.errors as unknown[]));
  }

  return errorPayloads.some((item) =>
    Boolean(item && typeof item === 'object' && 'reason' in item && (item as { reason?: string }).reason === 'notFound'),
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
    const clinicScope = user.ownerProfessionalId && user.teamRole !== 'admin' ? user.teamClinicId ?? null : null;
    const body = await request.json();
    const { patientId, date, time, type, status = 'pending' } = body ?? {};
    const requestedClinicId = typeof body?.clinicId === 'string' ? body.clinicId.trim() : '';

    if (!patientId || !date || !time || !type) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    if (!isCalendarReady()) {
      return NextResponse.json(
        {
          error:
            'Conectá tu cuenta de Google Calendar desde Configuración para poder sincronizar los turnos.',
        },
        { status: 400 },
      );
    }

    const [profile, credentials, patient] = await Promise.all([
      getProfessionalProfile(ownerProfessionalId),
      getProfessionalGoogleCredentials(ownerProfessionalId),
      getPatientById(ownerProfessionalId, patientId),
    ]);

    if (!patient) {
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
      const targetClinicId = selectedClinic?.id ?? patient.clinicId ?? null;
      if (targetClinicId && targetClinicId !== clinicScope) {
        return NextResponse.json(
          { error: 'No tenés permisos para agendar turnos en ese consultorio.' },
          { status: 403 },
        );
      }
    }

    if (selectedClinic && patient.clinicId && patient.clinicId !== selectedClinic.id) {
      return NextResponse.json(
        {
          error:
            'El paciente está asignado a otro consultorio. Actualizá su ficha antes de agendar en una sede diferente.',
        },
        { status: 409 },
      );
    }

    if (!credentials) {
      return NextResponse.json(
        {
          error:
            'Conectá tu cuenta de Google Calendar desde Configuración para poder sincronizar los turnos.',
        },
        { status: 400 },
      );
    }

    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const startAt = parseDateTimeInTimeZone(date, time, timeZone);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    let targetCalendarId = credentials.calendarId ?? 'primary';
    let appointmentClinicId: string | null = null;

    if (selectedClinic) {
      appointmentClinicId = selectedClinic.id;
      if (selectedClinic.calendarId) {
        targetCalendarId = selectedClinic.calendarId;
      }
    } else if (patient.clinicId) {
      const clinic = await getClinicByIdForOwner(ownerProfessionalId, patient.clinicId);
      if (clinic) {
        appointmentClinicId = clinic.id;
        if (clinic.calendarId) {
          targetCalendarId = clinic.calendarId;
        }
      }
    }

    const appointment: Appointment = await createAppointment(ownerProfessionalId, {
      patientId,
      title: type,
      status,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      calendarId: targetCalendarId,
      clinicId: appointmentClinicId,
    });

    const eventDetails = {
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
    } satisfies Parameters<typeof createCalendarEvent>[1];

    let activeTokenSet: OAuthTokenSet = {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      scope: credentials.scope,
      tokenType: credentials.tokenType,
      expiryDate: credentials.expiryDate,
    };

    const persistLatestCredentials = async (latest: OAuthTokenSet) => {
      const credentialsChanged =
        latest.accessToken !== activeTokenSet.accessToken ||
        latest.refreshToken !== activeTokenSet.refreshToken ||
        latest.scope !== activeTokenSet.scope ||
        latest.tokenType !== activeTokenSet.tokenType ||
        latest.expiryDate !== activeTokenSet.expiryDate;

      if (credentialsChanged) {
        await upsertProfessionalGoogleCredentials(ownerProfessionalId, {
          googleUserId: credentials.googleUserId,
          email: credentials.email,
          calendarId: credentials.calendarId ?? 'primary',
          accessToken: latest.accessToken,
          refreshToken: latest.refreshToken,
          scope: latest.scope,
          tokenType: latest.tokenType,
          expiryDate: latest.expiryDate,
        });
        activeTokenSet = latest;
      }
    };

    const syncWithCalendar = async (calendarIdToUse: string) => {
      const { event, latestCredentials } = await createCalendarEvent(activeTokenSet, {
        ...eventDetails,
        calendarId: calendarIdToUse,
      });

      await persistLatestCredentials(latestCredentials);

      if (!event.id) {
        throw new Error('La API de Google Calendar no devolvió un ID de evento.');
      }

      const updated = await attachAppointmentGoogleEvent(
        ownerProfessionalId,
        appointment.id,
        event.id,
        calendarIdToUse,
      );

      return formatAppointmentForTimeZone(updated ?? appointment, timeZone);
    };

    try {
      const responseAppointment = await syncWithCalendar(targetCalendarId);
      return NextResponse.json({ success: true, appointment: responseAppointment });
    } catch (error) {
      let calendarError: unknown = error;

      if (selectedClinic && targetCalendarId !== 'primary' && isCalendarNotFoundError(calendarError)) {
        try {
          const recreatedCalendar = await createCalendar(activeTokenSet, {
            summary: selectedClinic.name,
            description: `Agenda recreada automáticamente para el consultorio ${selectedClinic.name}`,
            timeZone,
          });

          const newCalendarId = recreatedCalendar.calendar.id;

          if (!newCalendarId) {
            throw new Error('Google no devolvió un nuevo identificador de calendario.');
          }

          await persistLatestCredentials(recreatedCalendar.latestCredentials);
          const updatedClinic = await updateClinic(ownerProfessionalId, selectedClinic.id, {
            calendarId: newCalendarId,
          });
          selectedClinic = updatedClinic;
          targetCalendarId = newCalendarId;

          const responseAppointment = await syncWithCalendar(targetCalendarId);
          return NextResponse.json({ success: true, appointment: responseAppointment });
        } catch (recoveryError) {
          console.error('No se pudo recrear el calendario del consultorio', recoveryError);
          calendarError = recoveryError;
        }
      }

      console.error('Error al crear evento en Google Calendar', calendarError);
      await deleteAppointment(ownerProfessionalId, appointment.id).catch(() => undefined);
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
