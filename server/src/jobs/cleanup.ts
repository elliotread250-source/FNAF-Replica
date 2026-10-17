import { and, eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { purgeExpiredSessions } from '../auth/sessions';

/** Purge expired sessions and guests idle for 30+ days. Runs on boot, then daily. */
export async function cleanup(db: Db): Promise<void> {
  await purgeExpiredSessions(db);
  const cutoff = new Date(Date.now() - 30 * 86400_000);
  await db.delete(users).where(and(eq(users.isGuest, true), lt(users.lastSeenAt, cutoff)));
}

export function startCleanup(db: Db, onError: (err: unknown) => void): NodeJS.Timeout {
  cleanup(db).catch(onError);
  return setInterval(() => cleanup(db).catch(onError), 86400_000);
}
