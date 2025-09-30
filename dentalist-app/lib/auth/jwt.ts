import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { User } from '@/types';

let cachedSecret: Secret | null = null;

function resolveAuthSecret(): Secret {
  if (cachedSecret) {
    return cachedSecret;
  }

  const candidates = [
    process.env.AUTH_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.SUPABASE_JWT_SECRET,
    process.env.JWT_SECRET,
    process.env.NODE_ENV !== 'production' ? 'dentalist-dev-secret' : undefined,
  ];

  const secret = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  if (!secret) {
    throw new Error(
      'No JWT secret configured. Set AUTH_SECRET (o SUPABASE_JWT_SECRET) en las variables de entorno.',
    );
  }

  cachedSecret = secret;
  return secret;
}

export interface DentalistJwtPayload extends JwtPayload, User {}

export function signToken(
  payload: User,
  expiresIn: SignOptions['expiresIn'] = '1d',
) {
  return jwt.sign(payload, resolveAuthSecret(), { expiresIn });
}

export function verifyToken(token: string) {
  return jwt.verify(token, resolveAuthSecret()) as DentalistJwtPayload;
}

export function signEphemeralToken<T extends object>(
  payload: T,
  expiresIn: SignOptions['expiresIn'] = '10m',
) {
  return jwt.sign(payload, resolveAuthSecret(), { expiresIn });
}

export function verifyEphemeralToken<T>(token: string) {
  return jwt.verify(token, resolveAuthSecret()) as T & JwtPayload;
}
