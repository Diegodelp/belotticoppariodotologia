import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getProfessionalProfile,
  listAppointments,
  listPatients,
  listPayments,
  listTreatments,
} from '@/lib/db/supabase-repository';
import {
  DEFAULT_TIME_ZONE,
  formatAppointmentsForTimeZone,
  normalizeTimeZone,
  parseDateTimeInTimeZone,
} from '@/lib/utils/timezone';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { message } = await request.json();
  const text: string = (message ?? '').toString().toLowerCase();

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

  let response = 'Soy el asistente virtual de Dentalist. Puedo ayudarte con pacientes, agenda, tratamientos y finanzas.';

  if (text.includes('pacient')) {
    const active = patients.filter((patient) => patient.status === 'active').length;
    response = `Actualmente tenés ${patients.length} pacientes cargados y ${active} con seguimiento activo. ¿Querés que revise un paciente en particular o que programe un recordatorio?`;
  } else if (text.includes('turno') || text.includes('agenda') || text.includes('calendario')) {
    const now = new Date();
    const nextAppointment = appointments
      .filter((appointment) => {
        const start = appointment.startAt
          ? new Date(appointment.startAt)
          : parseDateTimeInTimeZone(appointment.date, appointment.time, timeZone);
        return start >= now;
      })
      .sort((a, b) => {
        const aKey = a.startAt ?? `${a.date}T${a.time}`;
        const bKey = b.startAt ?? `${b.date}T${b.time}`;
        return aKey.localeCompare(bKey);
      })[0];
    if (nextAppointment) {
      const patient = patients.find((item) => item.id === nextAppointment.patientId);
      response = `Tu próximo turno es el ${nextAppointment.date} a las ${nextAppointment.time} con ${patient?.name ?? 'un paciente'} para ${nextAppointment.type}. ¿Querés reagendarlo o confirmar la asistencia?`;
    } else {
      response = 'No hay turnos próximos registrados. Podés crear uno nuevo desde la vista de Calendario.';
    }
  } else if (text.includes('tratamiento')) {
    const treatmentCounts = treatments.reduce<Record<string, number>>((acc, treatment) => {
      acc[treatment.type] = (acc[treatment.type] ?? 0) + 1;
      return acc;
    }, {});
    const topTreatment = Object.entries(treatmentCounts).sort((a, b) => b[1] - a[1])[0];
    if (topTreatment) {
      response = `El tratamiento más solicitado es ${topTreatment[0]} con ${topTreatment[1]} casos recientes. ¿Necesitás consultar detalles de algún paciente?`;
    } else {
      response = 'Todavía no registraste tratamientos. Podés hacerlo desde la ficha de cada paciente.';
    }
  } else if (text.includes('pago') || text.includes('cobro') || text.includes('saldo')) {
    const pendingAmount = payments
      .filter((payment) => payment.status === 'pending')
      .reduce((total, payment) => total + payment.amount, 0);
    response = pendingAmount
      ? `Tenés ${pendingAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} pendientes de cobro. ¿Querés enviar recordatorios de pago?`
      : 'No registrás pagos pendientes. ¡Buen trabajo con la gestión de cobranzas!';
  }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error al armar respuesta de chat con Supabase', error);
    return NextResponse.json(
      {
        response:
          'No pude acceder a los datos clínicos en este momento. Reintentá más tarde o verificá la conexión con Supabase.',
      },
      { status: 500 },
    );
  }
}