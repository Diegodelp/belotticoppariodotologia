import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: Implementar lógica de login
    return NextResponse.json({ success: true, token: 'fake-token' });
  } catch (error) {
    return NextResponse.json({ error: 'Error en login' }, { status: 500 });
  }
}