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

    try {
      const tokenSet: OAuthTokenSet = {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        scope: credentials.scope,
        tokenType: credentials.tokenType,
        expiryDate: credentials.expiryDate,
      };

      const { event, latestCredentials } = await createCalendarEvent(tokenSet, {
        calendarId: targetCalendarId,
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

      const updated = await attachAppointmentGoogleEvent(
        ownerProfessionalId,
        appointment.id,
        event.id,
        targetCalendarId,
      );
      const responseAppointment = formatAppointmentForTimeZone(updated ?? appointment, timeZone);

      return NextResponse.json({ success: true, appointment: responseAppointment });
    } catch (calendarError) {
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
