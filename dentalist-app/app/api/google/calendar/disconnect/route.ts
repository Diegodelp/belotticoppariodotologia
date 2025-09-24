import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { deleteProfessionalGoogleCredentials } from '@/lib/db/supabase-repository';

export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    await deleteProfessionalGoogleCredentials(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al desconectar Google Calendar', error);
    return NextResponse.json({ error: 'No pudimos desconectar Google Calendar' }, { status: 500 });
  }
}
