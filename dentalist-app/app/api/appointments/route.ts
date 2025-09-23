import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createAppointment,
  listAppointments,
  listPatients,
} from '@/lib/db/supabase-repository';
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

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error('Error al crear turno', error);
    return NextResponse.json(
      { error: 'No pudimos agendar el turno' },
      { status: 500 },
    );
  }
}
