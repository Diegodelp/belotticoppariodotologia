import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { isProPlan } from '@/lib/utils/subscription';
import { removeClinic, updateClinic } from '@/lib/db/supabase-repository';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      { error: 'Solo el administrador de la cuenta puede editar consultorios.' },
      { status: 403 },
    );
  }

  if (!isProPlan(user.subscriptionPlan)) {
    return NextResponse.json(
      {
        error:
          'Solo los profesionales con planes Pro o Enterprise pueden administrar múltiples consultorios.',
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const ownerProfessionalId = user.id;

  try {
    const body = await request.json();
    const updates: { name?: string; address?: string | null } = {};

    if (typeof body?.name === 'string') {
      updates.name = body.name.trim();
    }
    if (body?.address !== undefined) {
      const address = typeof body.address === 'string' ? body.address.trim() : '';
      updates.address = address ? address : null;
    }

    if (!('name' in updates) && !('address' in updates)) {
      return NextResponse.json(
        { error: 'No se enviaron cambios para actualizar.' },
        { status: 400 },
      );
    }

    const clinic = await updateClinic(ownerProfessionalId, id, updates);

    return NextResponse.json({ clinic, success: true });
  } catch (error) {
    console.error('Error al actualizar consultorio', error);
    return NextResponse.json(
      { error: 'No pudimos actualizar el consultorio.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      { error: 'Solo el administrador de la cuenta puede eliminar consultorios.' },
      { status: 403 },
    );
  }

  if (!isProPlan(user.subscriptionPlan)) {
    return NextResponse.json(
      {
        error: 'Solo los profesionales con planes Pro o Enterprise pueden eliminar consultorios.',
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const ownerProfessionalId = user.id;

  try {
    await removeClinic(ownerProfessionalId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar consultorio', error);
    return NextResponse.json(
      { error: 'No pudimos eliminar el consultorio. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
