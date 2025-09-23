import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  listAppointments,
  listPayments,
  listPatients,
  listTreatments,
} from '@/lib/db/supabase-repository';

function isSameMonth(dateIso: string, reference: Date) {
  const date = new Date(dateIso);
  return (
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear()
  );
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const today = new Date();

  try {
    const [patients, appointments, treatments, payments] = await Promise.all([
      listPatients(user.id),
      listAppointments(user.id),
      listTreatments(user.id),
      listPayments(user.id),
    ]);

    const activePatients = patients.filter((patient) => patient.status === 'active');

    const upcomingAppointments = appointments
      .filter((appointment) => new Date(`${appointment.date}T${appointment.time}`) >= new Date())
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .slice(0, 5);

    const revenueThisMonth = payments
      .filter((payment) => payment.status === 'completed' && isSameMonth(payment.date, today))
      .reduce((total, payment) => total + payment.amount, 0);

    const outstandingBalance = payments
      .filter((payment) => payment.status === 'pending')
      .reduce((total, payment) => total + payment.amount, 0);

    const treatmentByType = treatments.reduce<Record<string, number>>((acc, treatment) => {
      acc[treatment.type] = (acc[treatment.type] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      totals: {
        patients: patients.length,
        activePatients: activePatients.length,
        appointmentsToday: appointments.filter(
          (appointment) => appointment.date === today.toISOString().split('T')[0],
        ).length,
        revenueThisMonth,
        outstandingBalance,
        totalTreatments: treatments.length,
      },
      upcomingAppointments,
      treatmentByType,
    });
  } catch (error) {
    console.error('Error al armar overview desde Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener la información del dashboard' },
      { status: 500 },
    );
  }
}
