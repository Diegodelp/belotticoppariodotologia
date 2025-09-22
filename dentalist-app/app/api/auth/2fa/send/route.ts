import { NextRequest, NextResponse } from 'next/server';
import { findUserByDni, storeTwoFactorCode } from '@/lib/db/data-store';

function generateTwoFactorCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { dni, type } = await request.json();

    if (!dni || !type) {
      return NextResponse.json(
        { error: 'Debe indicar DNI y tipo de cuenta' },
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

    const code = generateTwoFactorCode();
    storeTwoFactorCode(user.id, code);

    return NextResponse.json({
      success: true,
      message: 'Generamos un nuevo código de verificación',
      code,
    });
  } catch (error) {
    console.error('Error al enviar código 2FA', error);
    return NextResponse.json(
      { error: 'Error al generar el código de seguridad' },
      { status: 500 },
    );
  }
}