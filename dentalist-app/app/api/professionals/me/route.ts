import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  getProfessionalProfile,
  updateProfessionalProfile,
  ProfessionalProfileUpdate,
} from '@/lib/db/supabase-repository';

export const runtime = 'nodejs';

function parseUpdates(input: unknown): ProfessionalProfileUpdate {
  if (!input || typeof input !== 'object') {
    throw new Error('Datos inválidos');
  }

  const record = input as Record<string, unknown>;
  const updates: ProfessionalProfileUpdate = {};

  if ('fullName' in record) {
    const value = record.fullName;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('El nombre debe ser texto');
    }
    updates.fullName = value as string | null;
  }

  if ('clinicName' in record) {
    const value = record.clinicName;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('El nombre comercial debe ser texto');
    }
    updates.clinicName = value as string | null;
  }

  if ('licenseNumber' in record) {
    const value = record.licenseNumber;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('La matrícula debe ser texto');
    }
    updates.licenseNumber = value as string | null;
  }

  if ('phone' in record) {
    const value = record.phone;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('El teléfono debe ser texto');
    }
    updates.phone = value as string | null;
  }

  if ('address' in record) {
    const value = record.address;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('La dirección debe ser texto');
    }
    updates.address = value as string | null;
  }

  if ('country' in record) {
    const value = record.country;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('El país debe ser texto');
    }
    updates.country = value as string | null;
  }

  if ('province' in record) {
    const value = record.province;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('La provincia debe ser texto');
    }
    updates.province = value as string | null;
  }

  if ('locality' in record) {
    const value = record.locality;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('La localidad debe ser texto');
    }
    updates.locality = value as string | null;
  }

  if ('timeZone' in record) {
    const value = record.timeZone;
    if (typeof value !== 'string' && value !== null) {
      throw new Error('La zona horaria debe ser texto');
    }
    updates.timeZone = value as string | null;
  }

  return updates;
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo disponible para profesionales' }, { status: 403 });
  }

  try {
    const profile = await getProfessionalProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error al obtener el perfil profesional', error);
    return NextResponse.json({ error: 'No pudimos cargar los datos' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (user.type !== 'profesional') {
    return NextResponse.json({ error: 'Solo disponible para profesionales' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = parseUpdates(body);
    const isInvitedProfessional = Boolean(user.ownerProfessionalId && user.teamRole === 'professional');

    if (isInvitedProfessional) {
      const allowed: Array<keyof ProfessionalProfileUpdate> = ['fullName', 'licenseNumber'];
      (Object.keys(updates) as Array<keyof ProfessionalProfileUpdate>).forEach((key) => {
        if (!allowed.includes(key)) {
          delete updates[key];
        }
      });
    }

    const profile = await updateProfessionalProfile(user.id, updates);

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Datos inválidos' ||
        error.message.includes('debe ser texto')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message === 'Profesional no encontrado') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    console.error('Error al actualizar el perfil profesional', error);
    return NextResponse.json({ error: 'No pudimos guardar los cambios' }, { status: 500 });
  }
}
