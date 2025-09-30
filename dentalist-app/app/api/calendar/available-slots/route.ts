import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { date } = await request.json();
  const baseSlots = [9, 10, 11, 12, 15, 16, 17, 18];

  if (!date) {
    return NextResponse.json(baseSlots);
  }

  const targetDate = new Date(date);
  const isWeekend = [0, 6].includes(targetDate.getDay());
  const slots = isWeekend ? baseSlots.filter((hour) => hour >= 10 && hour <= 14) : baseSlots;

  return NextResponse.json(slots);
}