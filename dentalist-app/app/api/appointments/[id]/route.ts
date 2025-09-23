import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { deleteAppointment, updateAppointment } from '@/lib/db/supabase-repository';

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
  return NextResponse.json({ success: true });
}
