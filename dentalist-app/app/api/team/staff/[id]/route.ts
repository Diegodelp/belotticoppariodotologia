import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { removeStaffMember } from '@/lib/db/supabase-repository';

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
    await removeStaffMember(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al quitar integrante del equipo', error);
    return NextResponse.json(
      { error: 'No pudimos quitar a la persona seleccionada.' },
      { status: 500 },
    );
  }
}
