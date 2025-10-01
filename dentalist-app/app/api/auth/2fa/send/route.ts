import { NextRequest, NextResponse } from 'next/server';
import { generateTwoFactorCode } from '@/lib/auth/two-factor';
import { findUserByDni, StaffAccessError, storeTwoFactorCode } from '@/lib/db/supabase-repository';
import { sendTwoFactorCodeEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest) {
  try {
    const { dni, type } = await request.json();

    if (!dni || !type) {
      return NextResponse.json(
        { error: 'Debe indicar DNI y tipo de cuenta' },
        { status: 400 },
      );
    }

    let user = null;
    try {
      user = await findUserByDni(dni, type);
    } catch (error) {
      if (error instanceof StaffAccessError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
    if (!user) {
      return NextResponse.json(
        { error: 'No encontramos una cuenta asociada' },
        { status: 404 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'La cuenta no tiene un correo electrónico registrado' },
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
      message: 'Enviamos el código de verificación a tu correo',
    });
  } catch (error) {
    console.error('Error al enviar código 2FA', error);
    return NextResponse.json(
      { error: 'Error al generar el código de seguridad' },
      { status: 500 },
    );
  }
}