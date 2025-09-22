import { NextRequest, NextResponse } from 'next/server';
import { dentalistDb } from '@/lib/db/data-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const appointment = dentalistDb.appointments.find(
      (item) => item.id === params.id,
    );

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
    }

    Object.assign(appointment, body);
    return NextResponse.json({ success: true, appointment });
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
  { params }: { params: { id: string } },
) {
  const index = dentalistDb.appointments.findIndex(
    (item) => item.id === params.id,
  );

  if (index === -1) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  dentalistDb.appointments.splice(index, 1);
  return NextResponse.json({ success: true });
}
