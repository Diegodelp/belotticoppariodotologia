import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getStaffInvitationById, revokeStaffInvitation } from '@/lib/db/supabase-repository';

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

    const invitation = await getStaffInvitationById(ownerProfessionalId, id);
    if (!invitation) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }

    if (!isOwner) {
      if (actingRole !== 'professional') {
        return NextResponse.json(
          { error: 'No tenés permisos para cancelar invitaciones.' },
          { status: 403 },
        );
      }

      if (invitation.role !== 'assistant') {
        return NextResponse.json(
          { error: 'Solo podés cancelar invitaciones de asistentes.' },
          { status: 403 },
        );
      }

      if (actingClinicId && invitation.clinicId && invitation.clinicId !== actingClinicId) {
        return NextResponse.json(
          { error: 'No podés modificar invitaciones de otros consultorios.' },
          { status: 403 },
        );
      }
    }

    await revokeStaffInvitation(ownerProfessionalId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al cancelar invitación', error);
    return NextResponse.json(
      { error: 'No pudimos cancelar la invitación. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
