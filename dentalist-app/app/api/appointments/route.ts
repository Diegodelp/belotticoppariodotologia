import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  attachAppointmentGoogleEvent,
  createAppointment,
  deleteAppointment,
  getPatientById,
  listAppointments,
  listPatients,
} from '@/lib/db/supabase-repository';
import {
  createCalendarEvent,
  isCalendarReady,
} from '@/lib/google/calendar';
import { Appointment, Patient } from '@/types';

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
    const [appointments, patients] = await Promise.all([
      listAppointments(user.id, patientId ?? undefined),
      listPatients(user.id),
    ]);

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
    const body = await request.json();
    const { patientId, date, time, type, status = 'pending' } = body ?? {};

    if (!patientId || !date || !time || !type) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    const appointment: Appointment = await createAppointment(user.id, {
      patientId,
      title: type,
      status,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    if (!isCalendarReady()) {
      await deleteAppointment(user.id, appointment.id);
      return NextResponse.json(
        {
          error:
            'Google Calendar no está configurado. Define las credenciales del servicio para poder agendar turnos.',
        },
        { status: 500 },
      );
    }

    if (!user.email) {
      await deleteAppointment(user.id, appointment.id);
      return NextResponse.json(
        {
          error:
            'Tu usuario no tiene un correo asociado. Actualizá el perfil antes de agendar turnos con Google Calendar.',
        },
        { status: 400 },
      );
    }

    try {
      const patient = patientId ? await getPatientById(user.id, patientId) : null;

      const event = await createCalendarEvent({
        calendarId: user.email,
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

      const updated = await attachAppointmentGoogleEvent(user.id, appointment.id, event.id);

      return NextResponse.json({ success: true, appointment: updated ?? appointment });
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
