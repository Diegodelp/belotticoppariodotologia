import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { listClinicsAndTeam } from '@/lib/db/supabase-repository';
import { getStaffSeatLimit } from '@/lib/utils/subscription';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const data = await listClinicsAndTeam(user.id);
    const plan = user.subscriptionPlan ?? 'starter';
    const seatLimit = getStaffSeatLimit(plan);
    const assistantLimit = seatLimit === null ? null : Math.max(seatLimit - 1, 0);

    const assistantsActive = data.staff.filter((member) => member.role === 'assistant').length;
    const assistantsPending = data.invitations.filter(
      (invitation) => invitation.role === 'assistant' && invitation.status === 'pending',
    ).length;

    return NextResponse.json({
      ...data,
      stats: {
        plan,
        clinicsEnabled: plan === 'pro',
        assistantLimit,
        assistantsActive,
        assistantsPending,
      },
    });
  } catch (error) {
    console.error('Error al obtener el equipo del profesional', error);
    return NextResponse.json(
      { error: 'No pudimos cargar la información del equipo. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
