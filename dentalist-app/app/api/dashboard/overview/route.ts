import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getProfessionalProfile,
  listAppointments,
  listPayments,
  listPatients,
  listTreatments,
} from '@/lib/db/supabase-repository';
import {
  DEFAULT_TIME_ZONE,
  formatAppointmentsForTimeZone,
  formatDateTimeInTimeZone,
  normalizeTimeZone,
  parseDateTimeInTimeZone,
} from '@/lib/utils/timezone';

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
    const [profile, patients, appointmentsRaw, treatments, payments] = await Promise.all([
      getProfessionalProfile(user.id),
      listPatients(user.id),
      listAppointments(user.id),
      listTreatments(user.id),
      listPayments(user.id),
    ]);

    const timeZone = normalizeTimeZone(profile?.timeZone ?? user.timeZone ?? DEFAULT_TIME_ZONE);
    const appointments = formatAppointmentsForTimeZone(appointmentsRaw, timeZone);
    const todayInZone = formatDateTimeInTimeZone(today, timeZone).date;

    const activePatients = patients.filter((patient) => patient.status === 'active');

    const upcomingAppointments = appointments
      .filter((appointment) => {
        const start = appointment.startAt
          ? new Date(appointment.startAt)
          : parseDateTimeInTimeZone(appointment.date, appointment.time, timeZone);
        return start >= today;
      })
      .sort((a, b) => {
        const aKey = a.startAt ?? `${a.date}T${a.time}`;
        const bKey = b.startAt ?? `${b.date}T${b.time}`;
        return aKey.localeCompare(bKey);
      })
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
          (appointment) => appointment.date === todayInZone,
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
