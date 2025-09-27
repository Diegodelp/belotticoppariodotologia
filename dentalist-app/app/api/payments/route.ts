import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createPayment,
  listPatients,
  listPayments,
  updatePayment,
  deletePayment,
} from '@/lib/db/supabase-repository';
import { Payment, Patient } from '@/types';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId') ?? undefined;
  const status = searchParams.get('status');

  try {
    const [payments, patients] = await Promise.all([
      listPayments(user.id, patientId ?? undefined),
      listPatients(user.id),
    ]);

    const filtered = status
      ? payments.filter((payment) => payment.status === status)
      : payments;

    const patientMap = new Map(patients.map((patient) => [patient.id, patient] as [string, Patient]));

    const withPatient = filtered.map((payment) => ({
      ...payment,
      patient: patientMap.get(payment.patientId),
    }));

    return NextResponse.json(withPatient);
  } catch (error) {
    console.error('Error al obtener pagos en Supabase', error);
    return NextResponse.json(
      { error: 'No pudimos obtener los pagos' },
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
    const { patientId, amount, method, status = 'completed', date, notes } =
      body ?? {};

    if (!patientId || !amount || !method) {
      return NextResponse.json(
        { error: 'Paciente, monto y medio de pago son obligatorios' },
        { status: 400 },
      );
    }

    const paymentDate = date ? new Date(date).toISOString() : new Date().toISOString();

    const payment: Payment = await createPayment(user.id, {
      patientId,
      amount,
      method,
      status,
      date: paymentDate,
      notes,
    });

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('Error al registrar pago', error);
    return NextResponse.json(
      { error: 'No pudimos registrar el pago' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, amount, method, status = 'completed', date, notes } = body ?? {};

    if (!id || typeof amount !== 'number' || !method) {
      return NextResponse.json(
        { error: 'Identificador, monto y medio de pago son obligatorios.' },
        { status: 400 },
      );
    }

    const payment = await updatePayment(user.id, id, {
      amount,
      method,
      status,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      notes: typeof notes === 'string' ? notes : null,
    });

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('Error al actualizar pago', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos actualizar el pago' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId') ?? searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'Identificador de pago inválido.' }, { status: 400 });
    }

    await deletePayment(user.id, paymentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar pago', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No pudimos eliminar el pago' },
      { status: 500 },
    );
  }
}
