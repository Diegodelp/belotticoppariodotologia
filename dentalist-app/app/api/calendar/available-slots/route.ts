import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { date } = await request.json();
  return NextResponse.json([9, 10, 11, 12, 15, 16, 17, 18]);
}