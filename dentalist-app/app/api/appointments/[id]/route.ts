import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  deleteAppointment,
  getAppointmentById,
  getPatientById,
  updateAppointment,
} from '@/lib/db/supabase-repository';
import {
  deleteCalendarEvent,
  isCalendarReady,
  updateCalendarEvent,
} from '@/lib/google/calendar';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const body = await request.json();
    const params = await context.params;
    const current = await getAppointmentById(user.id, params.id);

    if (!current) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    const { status, type, date, time } = body ?? {};
    const updated = await updateAppointment(user.id, params.id, {
      status,
      type,
      date,
      time,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    if (!updated.googleEventId) {
      return NextResponse.json({ success: true, appointment: updated });
    }

    if (!isCalendarReady()) {
      await updateAppointment(user.id, params.id, {
        status: current.status,
        type: current.type,
        date: current.date,
        time: current.time,
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error:
            'Google Calendar no está configurado. Configurá las credenciales para poder actualizar el turno.',
        },
        { status: 500 },
      );
    }

    if (!user.email) {
      await updateAppointment(user.id, params.id, {
        status: current.status,
        type: current.type,
        date: current.date,
        time: current.time,
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error: 'El profesional no tiene un correo configurado para sincronizar con Google Calendar.',
        },
        { status: 400 },
      );
    }

    try {
      const patient = updated.patientId ? await getPatientById(user.id, updated.patientId) : null;
      const start = updated.startAt ? new Date(updated.startAt) : new Date(`${updated.date}T${updated.time}:00`);
      const end = updated.endAt ? new Date(updated.endAt) : new Date(start.getTime() + 60 * 60 * 1000);

      await updateCalendarEvent({
        calendarId: user.email,
        eventId: updated.googleEventId,
        summary: `${updated.type} con ${patient ? `${patient.name} ${patient.lastName}` : 'paciente'}`,
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
    } catch (calendarError) {
      console.error('Error al actualizar evento en Google Calendar', calendarError);
      await updateAppointment(user.id, params.id, {
        status: current.status,
        type: current.type,
        date: current.date,
        time: current.time,
      }).catch(() => undefined);
      return NextResponse.json(
        {
          error:
            'No pudimos sincronizar el turno en Google Calendar. Intentalo nuevamente cuando la conexión esté disponible.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, appointment: updated });
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

  if (deleted.googleEventId && isCalendarReady() && user.email) {
    try {
      await deleteCalendarEvent({
        calendarId: user.email,
        eventId: deleted.googleEventId,
      });
    } catch (error) {
      console.error('No se pudo eliminar el evento en Google Calendar', error);
    }
  }

  return NextResponse.json({ success: true });
}
