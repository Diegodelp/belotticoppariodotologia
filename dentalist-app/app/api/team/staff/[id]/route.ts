import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getStaffMemberById, removeStaffMember } from '@/lib/db/supabase-repository';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;
    const isOwner = !user.ownerProfessionalId;
    const actingRole = user.teamRole ?? (isOwner ? 'admin' : null);
    const actingClinicId = user.teamClinicId ?? null;

    const staffMember = await getStaffMemberById(ownerProfessionalId, id);
    if (!staffMember) {
      return NextResponse.json({ error: 'Integrante no encontrado' }, { status: 404 });
    }

    if (!isOwner) {
      if (actingRole !== 'professional') {
        return NextResponse.json(
          { error: 'No tenés permisos para modificar el equipo.' },
          { status: 403 },
        );
      }

      if (staffMember.role !== 'assistant') {
        return NextResponse.json(
          { error: 'Solo podés gestionar asistentes.' },
          { status: 403 },
        );
      }

      if (actingClinicId && staffMember.clinicId && staffMember.clinicId !== actingClinicId) {
        return NextResponse.json(
          { error: 'No podés gestionar integrantes de otros consultorios.' },
          { status: 403 },
        );
      }
    }

    await removeStaffMember(ownerProfessionalId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al quitar integrante del equipo', error);
    return NextResponse.json(
      { error: 'No pudimos quitar a la persona seleccionada.' },
      { status: 500 },
    );
  }
}
