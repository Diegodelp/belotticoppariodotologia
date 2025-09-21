import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { clinicalHistory } = await request.json();
  return NextResponse.json({
    diagnosis: {
      summary: 'Análisis generado por IA',
      recommendations: []
    }
  });
}