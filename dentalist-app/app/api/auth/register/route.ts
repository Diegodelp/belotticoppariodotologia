import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { addUser, findUserByDni } from '@/lib/db/data-store';

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

    const existingUser = findUserByDni(dni, type);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese DNI' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    addUser({
      id: crypto.randomUUID(),
      dni,
      name,
      email,
      type,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al registrar usuario', error);
    return NextResponse.json(
      { error: 'Error al registrar el usuario' },
      { status: 500 },
    );
  }
}