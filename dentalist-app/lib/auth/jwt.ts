import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { User } from '@/types';

const AUTH_SECRET: Secret = process.env.AUTH_SECRET ?? 'dentalist-secret';

export interface DentalistJwtPayload extends JwtPayload, User {}

export function signToken(
  payload: User,
  expiresIn: SignOptions['expiresIn'] = '1d'
) {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn });
}

export function verifyToken(token: string) {
  return jwt.verify(token, AUTH_SECRET) as DentalistJwtPayload;
}
