import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const COOKIE = 'fr_session';
export const SESSION_DAYS = 30;
const REFRESH_MS = 60 * 60_000;

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export async function createSession(db: Db, secret: string, userId: string, userAgent?: string): Promise<{ token: string; expires: Date }> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token, secret), userAgent: userAgent?.slice(0, 200), expiresAt: expires });
  return { token, expires };
}

export type SessionUser = typeof users.$inferSelect;

/** Resolve a cookie token to a user, rolling the expiry at most once an hour. */
export async function userForToken(db: Db, secret: string, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const th = hashToken(token, secret);
  const rows = await db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, th), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - row.s.refreshedAt.getTime() > REFRESH_MS) {
    const now = new Date();
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now.getTime() + SESSION_DAYS * 86400_000), refreshedAt: now })
      .where(eq(sessions.id, row.s.id));
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, row.u.id));
  }
  return row.u;
}

export async function destroySession(db: Db, secret: string, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token, secret)));
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
