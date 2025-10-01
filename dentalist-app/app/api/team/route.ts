import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getProfessionalSubscriptionSummary, listClinicsAndTeam } from '@/lib/db/supabase-repository';
import { getClinicLimit, getStaffSeatLimit } from '@/lib/utils/subscription';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;

    const [data, subscription] = await Promise.all([
      listClinicsAndTeam(ownerProfessionalId),
      getProfessionalSubscriptionSummary(ownerProfessionalId),
    ]);
    const plan = subscription.plan ?? 'starter';
    const seatLimit = getStaffSeatLimit(plan);
    const assistantLimit = seatLimit === null ? null : Math.max(seatLimit - 1, 0);
    const clinicLimit = getClinicLimit(plan);
    const clinicsActive = data.clinics.length;
    const clinicsRemaining = clinicLimit === null ? null : Math.max(clinicLimit - clinicsActive, 0);
    const clinicsEnabled =
      plan === 'pro' && (clinicLimit === null || clinicsRemaining === null || clinicsRemaining > 0);

    const assistantsActive = data.staff.filter(
      (member) => member.role === 'assistant' && member.status === 'active',
    ).length;
    const assistantsPending = data.invitations.filter(
      (invitation) => invitation.role === 'assistant' && invitation.status === 'pending',
    ).length;

    return NextResponse.json({
      ...data,
      stats: {
        plan,
        clinicsEnabled,
        clinicLimit,
        clinicsActive,
        clinicsRemaining,
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
