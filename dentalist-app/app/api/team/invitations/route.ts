import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { createStaffInvitation, listClinicsAndTeam } from '@/lib/db/supabase-repository';
import { getStaffSeatLimit } from '@/lib/utils/subscription';
import { StaffRole } from '@/types';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const email = (body?.email as string | undefined)?.trim();
    const role = body?.role as StaffRole | undefined;
    const clinicId = (body?.clinicId as string | undefined) ?? null;

    if (!email) {
      return NextResponse.json(
        { error: 'Ingresá el correo electrónico de la persona que querés invitar.' },
        { status: 400 },
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: 'Seleccioná el rol que tendrá la persona invitada.' },
        { status: 400 },
      );
    }

    const plan = user.subscriptionPlan ?? 'starter';
    const seatLimit = getStaffSeatLimit(plan);
    const assistantLimit = seatLimit === null ? null : Math.max(seatLimit - 1, 0);

    const { staff, invitations } = await listClinicsAndTeam(user.id);

    if (plan !== 'pro') {
      if (role !== 'assistant') {
        return NextResponse.json(
          { error: 'En el plan Starter solo podés invitar asistentes.' },
          { status: 403 },
        );
      }

      if (clinicId) {
        return NextResponse.json(
          { error: 'El plan Starter no admite múltiples consultorios.' },
          { status: 400 },
        );
      }
    }

    const assistantsActive = staff.filter((member) => member.role === 'assistant').length;
    const assistantsPending = invitations.filter(
      (inv) => inv.role === 'assistant' && inv.status === 'pending',
    ).length;

    if (assistantLimit !== null && role === 'assistant') {
      if (assistantsActive + assistantsPending >= assistantLimit) {
        return NextResponse.json(
          {
            error: 'Alcanzaste el cupo de asistentes incluido en tu plan. Eliminá uno existente o actualizá a Dentalist Pro.',
          },
          { status: 403 },
        );
      }
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { invitation, token } = await createStaffInvitation(user.id, {
      email,
      role,
      clinicId,
      expiresAt,
    });

    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const inviteUrl = `${origin}/register?invite=${token}`;

    return NextResponse.json({ invitation: { ...invitation, token }, inviteUrl, success: true });
  } catch (error) {
    console.error('Error al invitar integrante del equipo', error);
    return NextResponse.json(
      { error: 'No pudimos generar la invitación. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
