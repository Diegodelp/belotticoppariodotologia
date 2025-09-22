import { NextResponse } from 'next/server';
import { getAppointments, getPayments, getPatients, getTreatments } from '@/lib/db/data-store';

function isSameMonth(dateIso: string, reference: Date) {
  const date = new Date(dateIso);
  return (
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear()
  );
}

export async function GET() {
  const patients = getPatients();
  const appointments = getAppointments();
  const treatments = getTreatments();
  const payments = getPayments();
  const today = new Date();

  const activePatients = patients.filter((patient) => patient.status === 'active');

  const upcomingAppointments = appointments
    .filter((appointment) => new Date(appointment.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
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
}
