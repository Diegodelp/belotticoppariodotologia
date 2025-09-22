import { NextRequest, NextResponse } from 'next/server';
import {
  findUserByDni,
  toPublicUser,
  validateTwoFactorCode,
} from '@/lib/db/data-store';
import { signToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const { dni, code, type } = await request.json();

    if (!dni || !code || !type) {
      return NextResponse.json(
        { error: 'Debe indicar DNI, código y tipo de cuenta' },
        { status: 400 },
      );
    }

    const user = findUserByDni(dni, type);
    if (!user) {
      return NextResponse.json(
        { error: 'No encontramos una cuenta asociada' },
        { status: 404 },
      );
    }

    const validation = validateTwoFactorCode(user.id, code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason ?? 'Código inválido' },
        { status: 400 },
      );
    }

    const token = signToken(toPublicUser(user));
    const response = NextResponse.json({
      success: true,
      token,
      user: toPublicUser(user),
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error('Error al verificar código 2FA', error);
    return NextResponse.json(
      { error: 'No pudimos validar el código' },
      { status: 500 },
    );
  }
}