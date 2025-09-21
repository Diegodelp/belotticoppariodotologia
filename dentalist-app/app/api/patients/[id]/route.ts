import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ id: params.id });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ success: true });
}