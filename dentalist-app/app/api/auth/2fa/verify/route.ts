import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { dni, code, type } = await request.json();
    // TODO: Verificar código
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
  }
}