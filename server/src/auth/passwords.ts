import { hash, verify } from '@node-rs/argon2';

// OWASP minimum for Argon2id: 19 MiB, 2 iterations, parallelism 1.
const OPTS = { algorithm: 2 /* Algorithm.Argon2id (const enum) */, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, OPTS);
}

export async function verifyPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) return false;
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}
