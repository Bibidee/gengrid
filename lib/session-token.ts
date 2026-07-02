import { randomBytes, createHash } from 'crypto';

/** Generates a random opaque session token for a joined player. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/** One-way hash of a session token — only the hash is ever stored. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
