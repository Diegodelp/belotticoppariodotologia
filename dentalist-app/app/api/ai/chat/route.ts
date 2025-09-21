import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  return NextResponse.json({ 
    response: 'Soy el asistente de Dentalist. ¿En qué puedo ayudarte?' 
  });
}