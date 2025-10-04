import { NextRequest, NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth/get-user';
import { getClinicByIdForOwner, listClinicsForProfessional } from '@/lib/db/supabase-repository';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user || user.type !== 'profesional') {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const ownerProfessionalId = user.ownerProfessionalId ?? user.id;

    if (user.ownerProfessionalId && user.teamRole !== 'admin') {
      if (!user.teamClinicId) {
        return NextResponse.json([]);
      }

      const clinic = await getClinicByIdForOwner(ownerProfessionalId, user.teamClinicId);
      return NextResponse.json(clinic ? [clinic] : []);
    }

    const clinics = await listClinicsForProfessional(ownerProfessionalId);
    return NextResponse.json(clinics);
  } catch (error) {
    console.error('Error al obtener consultorios', error);
    return NextResponse.json({ error: 'No pudimos cargar los consultorios.' }, { status: 500 });
  }
}
