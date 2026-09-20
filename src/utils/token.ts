import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';

export function signAuthToken(payload: { id: string; name: string; email: string; role: UserRole }): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function publicUser(user: { id?: string; _id?: unknown; name: string; email: string; role: UserRole }) {
  return {
    id: user.id ?? String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
