import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { dni, type } = await request.json();
    // TODO: Enviar código 2FA
    return NextResponse.json({ success: true, message: 'Código enviado' });
  } catch (error) {
    return NextResponse.json({ error: 'Error al enviar código' }, { status: 500 });
  }
}