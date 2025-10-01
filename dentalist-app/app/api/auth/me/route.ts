import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { findUserByDni, StaffAccessError, toPublicUser } from '@/lib/db/supabase-repository';

function extractToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.substring(7);
  }
  return request.cookies.get('token')?.value ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    let user = null;
    try {
      user = await findUserByDni(payload.dni, payload.type);
    } catch (error) {
      if (error instanceof StaffAccessError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error('Error al obtener sesión', error);
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }
}
