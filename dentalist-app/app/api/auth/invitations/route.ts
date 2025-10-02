import { NextRequest, NextResponse } from 'next/server';

import {
  acceptStaffInvitation,
  getStaffInvitationDetails,
} from '@/lib/db/supabase-repository';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Falta el token de invitación.' }, { status: 400 });
  }

  try {
    const details = await getStaffInvitationDetails(token);

    if (!details) {
      return NextResponse.json({ error: 'La invitación no es válida o ya fue utilizada.' }, { status: 404 });
    }

    const { invitation, owner } = details;

    return NextResponse.json({
      invitation,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        clinicName: owner.clinicName,
        subscriptionPlan: owner.subscriptionPlan,
        subscriptionStatus: owner.subscriptionStatus,
      },
    });
  } catch (error) {
    console.error('Error al obtener la invitación de staff', error);
    return NextResponse.json(
      { error: 'No pudimos validar la invitación. Intentá nuevamente más tarde.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body?.token as string | undefined)?.trim();
    const dni = (body?.dni as string | undefined)?.trim();
    const name = (body?.name as string | undefined)?.trim();
    const password = body?.password as string | undefined;

    if (!token || !dni || !name || !password) {
      return NextResponse.json(
        { error: 'Debés completar DNI, nombre, contraseña y token de invitación.' },
        { status: 400 },
      );
    }

    const result = await acceptStaffInvitation({ token, dni, name, password });

    return NextResponse.json({
      success: true,
      staff: result.staff,
      ownerId: result.ownerId,
      user: result.user,
    });
  } catch (error) {
    console.error('Error al aceptar invitación de staff', error);
    const message = error instanceof Error ? error.message : 'No pudimos completar la invitación.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
