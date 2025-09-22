import { NextRequest, NextResponse } from 'next/server';
import {
  addAppointment,
  getAppointments,
  getPatients,
} from '@/lib/db/data-store';
import { Appointment } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let appointments = getAppointments(patientId ?? undefined);

  if (status) {
    appointments = appointments.filter((item) => item.status === status);
  }

  if (from) {
    appointments = appointments.filter((item) => item.date >= from);
  }

  if (to) {
    appointments = appointments.filter((item) => item.date <= to);
  }

  const patients = getPatients();
  const withPatient = appointments.map((appointment) => ({
    ...appointment,
    patient: patients.find((patient) => patient.id === appointment.patientId),
  }));

  return NextResponse.json(withPatient);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, date, time, type, status = 'pending' } = body ?? {};

    if (!patientId || !date || !time || !type) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    const appointment: Appointment = {
      id: crypto.randomUUID(),
      patientId,
      date,
      time,
      type,
      status,
    };

    addAppointment(appointment);
    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error('Error al crear turno', error);
    return NextResponse.json(
      { error: 'No pudimos agendar el turno' },
      { status: 500 },
    );
  }
}
