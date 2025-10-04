import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { User } from '@/types';

export function getUserFromRequest(request: NextRequest): User | null {
  const header = request.headers.get('authorization');
  let token: string | null = null;

  if (header?.startsWith('Bearer ')) {
    token = header.substring(7);
  } else {
    token = request.cookies.get('token')?.value ?? null;
  }

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch (error) {
    console.error('Token inválido', error);
    return null;
  }
}
