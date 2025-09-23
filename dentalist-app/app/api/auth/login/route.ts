import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserByDni, storeTwoFactorCode, toPublicUser } from '@/lib/db/supabase-repository';
import { sendTwoFactorCodeEmail } from '@/lib/email/mailer';
import { generateTwoFactorCode } from '@/lib/auth/two-factor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dni, password, type } = body ?? {};

    if (!dni || !password || !type) {
      return NextResponse.json(
        { error: 'Debe completar DNI, contraseña y tipo de usuario' },
        { status: 400 },
      );
    }

    const user = await findUserByDni(dni, type);

    if (!user) {
      return NextResponse.json(
        { error: 'No encontramos una cuenta con esos datos' },
        { status: 404 },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'La cuenta aún no tiene una contraseña establecida.' },
        { status: 400 },
      );
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'La contraseña ingresada no es correcta' },
        { status: 401 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          error:
            'La cuenta no tiene un correo electrónico registrado para enviar el código de verificación.',
        },
        { status: 422 },
      );
    }

    const code = generateTwoFactorCode();
    await storeTwoFactorCode(user, code);

    await sendTwoFactorCodeEmail({
      to: user.email,
      code,
      expiresMinutes: 5,
      locale: 'es',
    });

    return NextResponse.json({
      success: true,
      requiresTwoFactor: true,
      message:
        'Enviamos un código de verificación al correo registrado. Ingréselo para continuar.',
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Error en login', error);
    return NextResponse.json(
      { error: 'No pudimos iniciar sesión, intente nuevamente' },
      { status: 500 },
    );
  }
}
