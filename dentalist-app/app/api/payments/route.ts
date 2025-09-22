import { NextRequest, NextResponse } from 'next/server';
import { addPayment, getPayments, getPatients } from '@/lib/db/data-store';
import { Payment } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const status = searchParams.get('status');

  let payments = getPayments(patientId);

  if (status) {
    payments = payments.filter((payment) => payment.status === status);
  }

  const patients = getPatients();
  const withPatient = payments.map((payment) => ({
    ...payment,
    patient: patients.find((patient) => patient.id === payment.patientId),
  }));

  return NextResponse.json(withPatient);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, amount, method, status = 'completed', date, notes } =
      body ?? {};

    if (!patientId || !amount || !method) {
      return NextResponse.json(
        { error: 'Paciente, monto y medio de pago son obligatorios' },
        { status: 400 },
      );
    }

    const payment: Payment = {
      id: crypto.randomUUID(),
      patientId,
      amount,
      method,
      status,
      date: date ?? new Date().toISOString(),
      notes,
    };

    addPayment(payment);
    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('Error al registrar pago', error);
    return NextResponse.json(
      { error: 'No pudimos registrar el pago' },
      { status: 500 },
    );
  }
}
