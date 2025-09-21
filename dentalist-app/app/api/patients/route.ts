import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ success: true, id: '1' });
}