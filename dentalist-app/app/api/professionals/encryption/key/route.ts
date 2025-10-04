import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import {
  ensureProfessionalEncryptionKey,
  rotateProfessionalEncryptionKey,
} from '@/lib/db/supabase-repository';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const status = await ensureProfessionalEncryptionKey(user.id);
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error al obtener la clave de cifrado', error);
    return NextResponse.json(
      { error: 'No pudimos recuperar la clave de cifrado. Verificá tu configuración e intentá nuevamente.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const status = await rotateProfessionalEncryptionKey(user.id);
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error al rotar la clave de cifrado', error);
    return NextResponse.json(
      { error: 'No pudimos rotar la clave de cifrado. Reintentá en unos minutos.' },
      { status: 500 },
    );
  }
}
