import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { revokeStaffInvitation } from '@/lib/db/supabase-repository';

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
    await revokeStaffInvitation(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al cancelar invitación', error);
    return NextResponse.json(
      { error: 'No pudimos cancelar la invitación. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
