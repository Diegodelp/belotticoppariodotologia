import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '@/types';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'dentalist-secret';

export interface DentalistJwtPayload extends JwtPayload, User {}

export function signToken(payload: User, expiresIn = '1d') {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn });
}

export function verifyToken(token: string) {
  return jwt.verify(token, AUTH_SECRET) as DentalistJwtPayload;
}
