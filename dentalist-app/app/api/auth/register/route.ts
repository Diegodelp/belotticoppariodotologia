import { NextRequest, NextResponse } from 'next/server';
import { registerProfessional } from '@/lib/db/supabase-repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dni, password, name, email, type } = body ?? {};

    if (!dni || !password || !name || !email || !type) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 },
      );
    }

    if (type !== 'profesional') {
      return NextResponse.json(
        { error: 'Por el momento solo podemos registrar profesionales desde esta pantalla.' },
        { status: 400 },
      );
    }

    try {
      await registerProfessional({ dni, name, email, password });
    } catch (error) {
      console.error('Error al registrar profesional en Supabase', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No pudimos crear la cuenta' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al registrar usuario', error);
    return NextResponse.json(
      { error: 'Error al registrar el usuario' },
      { status: 500 },
    );
  }
}