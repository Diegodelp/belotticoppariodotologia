import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  createClinic,
  getClinicCountForProfessional,
  getProfessionalSubscriptionSummary,
} from '@/lib/db/supabase-repository';
import { getClinicLimit } from '@/lib/utils/subscription';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.ownerProfessionalId) {
    return NextResponse.json(
      { error: 'Solo el administrador de la cuenta puede crear consultorios.' },
      { status: 403 },
    );
  }

  const ownerProfessionalId = user.id;

  const [subscription, existingCount] = await Promise.all([
    getProfessionalSubscriptionSummary(ownerProfessionalId),
    getClinicCountForProfessional(ownerProfessionalId),
  ]);

  if (subscription.plan !== 'pro') {
    return NextResponse.json(
      {
        error: 'La gestión de consultorios múltiples es parte del plan Pro. Actualizá tu suscripción para habilitarla.',
      },
      { status: 403 },
    );
  }

  const clinicLimit = getClinicLimit(subscription.plan);
  if (clinicLimit !== null && existingCount >= clinicLimit) {
    return NextResponse.json(
      {
        error: `Alcanzaste el máximo de ${clinicLimit} consultorios disponibles en tu plan Pro. Eliminá uno existente para crear un nuevo consultorio.`,
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const name = (body?.name as string | undefined)?.trim();
    const address = (body?.address as string | undefined)?.trim();

    if (!name) {
      return NextResponse.json(
        { error: 'Ingresá un nombre para el consultorio o clínica.' },
        { status: 400 },
      );
    }

    const clinic = await createClinic(ownerProfessionalId, { name, address: address ?? null });

    return NextResponse.json({ clinic, success: true });
  } catch (error) {
    console.error('Error al crear consultorio', error);
    return NextResponse.json(
      { error: 'No pudimos crear el consultorio. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
