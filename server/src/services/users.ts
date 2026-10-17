import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  ACHIEVEMENTS_BY_ID,
  COSMETICS_BY_ID,
  DEFAULT_COSMETICS,
  DEFAULT_EQUIPPED,
  PRESETS,
  type PublicUser,
} from '@fnaf/shared';
import type { Db } from '../db/client';
import { achievements, archiveUnlocks, progress, stats, userCosmetics, users } from '../db/schema';

export type UserRow = typeof users.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type DbOrTx = Db | Tx;

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.usernameDisplay,
    displayName: u.displayName,
    isGuest: u.isGuest,
    fazTokens: u.fazTokens,
    stars: u.stars,
    equipped: { ...DEFAULT_EQUIPPED, ...u.equipped },
    settings: u.settings,
    createdAt: u.createdAt.toISOString(),
    email: u.email,
  };
}

export async function createUser(
  db: Db,
  o: { username: string; displayName: string; passwordHash: string | null; email?: string | null; isGuest: boolean },
): Promise<UserRow> {
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        username: o.username.toLowerCase(),
        usernameDisplay: o.username,
        displayName: o.displayName,
        passwordHash: o.passwordHash,
        email: o.email ?? null,
        isGuest: o.isGuest,
        equipped: { ...DEFAULT_EQUIPPED },
      })
      .returning();
    await tx.insert(userCosmetics).values(DEFAULT_COSMETICS.map((cosmeticId) => ({ userId: u.id, cosmeticId, source: 'default' })));
    await tx.insert(stats).values({ userId: u.id });
    await tx.insert(progress).values(['nightshift', 'classic', 'showtime'].map((mode) => ({ userId: u.id, mode })));
    return u;
  });
}

export async function findByUsername(db: Db, username: string): Promise<UserRow | undefined> {
  const [u] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  return u;
}

export async function findById(db: DbOrTx, id: string): Promise<UserRow | undefined> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u;
}

export async function ownedCosmetics(db: DbOrTx, userId: string): Promise<string[]> {
  const rows = await db.select({ id: userCosmetics.cosmeticId }).from(userCosmetics).where(eq(userCosmetics.userId, userId));
  return rows.map((r) => r.id);
}

export async function loadMe(db: Db, userId: string) {
  const u = await findById(db, userId);
  if (!u) return null;
  const [cos, prog, st, ach, arch] = await Promise.all([
    ownedCosmetics(db, userId),
    db.select().from(progress).where(eq(progress.userId, userId)),
    db.select().from(stats).where(eq(stats.userId, userId)),
    db.select().from(achievements).where(eq(achievements.userId, userId)),
    db.select().from(archiveUnlocks).where(eq(archiveUnlocks.userId, userId)),
  ]);
  const s = st[0];
  return {
    user: publicUser(u),
    cosmetics: cos,
    progress: Object.fromEntries(prog.map((p) => [p.mode, { highestNight: p.highestNight, presetsBeaten: p.presetsBeaten }])),
    stats: s
      ? {
          nights_played: s.nightsPlayed,
          nights_survived: s.nightsSurvived,
          deaths: s.deaths,
          deaths_by: s.deathsBy,
          camera_checks: s.cameraChecks,
          doors_closed: s.doorsClosed,
          power_used_total: s.powerUsedTotal,
          showtime_kills: s.showtimeKills,
          showtime_wins_as_puppeteer: s.showtimeWinsAsPuppeteer,
          playtime_seconds: s.playtimeSeconds,
          skin_changes: s.skinChanges,
        }
      : null,
    achievements: ach.map((a) => ({ id: a.achievementId, at: a.unlockedAt.toISOString() })),
    archive: arch.map((a) => ({ kind: a.kind, id: a.itemId })),
  };
}

/** Grant cosmetics, ignoring ones already owned. */
export async function grantCosmetics(db: DbOrTx, userId: string, ids: string[], source: string): Promise<string[]> {
  const valid = ids.filter((id) => COSMETICS_BY_ID[id]);
  if (!valid.length) return [];
  const rows = await db
    .insert(userCosmetics)
    .values(valid.map((cosmeticId) => ({ userId, cosmeticId, source })))
    .onConflictDoNothing()
    .returning({ id: userCosmetics.cosmeticId });
  return rows.map((r) => r.id);
}

/** Unlock achievements (and their reward cosmetics). Returns the newly unlocked ids. */
export async function grantAchievements(db: DbOrTx, userId: string, ids: string[]): Promise<string[]> {
  const valid = [...new Set(ids)].filter((id) => ACHIEVEMENTS_BY_ID[id]);
  if (!valid.length) return [];
  const rows = await db
    .insert(achievements)
    .values(valid.map((achievementId) => ({ userId, achievementId })))
    .onConflictDoNothing()
    .returning({ id: achievements.achievementId });
  const fresh = rows.map((r) => r.id);
  const rewards = fresh.map((id) => ACHIEVEMENTS_BY_ID[id]?.reward).filter((x): x is string => Boolean(x));
  if (rewards.length) await grantCosmetics(db, userId, rewards, 'achievement');
  return fresh;
}

/** Stars: Night 5, Night 6, 4/20, and the hidden golden star for every preset. */
export async function recomputeStars(db: DbOrTx, userId: string): Promise<number> {
  const prog = await db.select().from(progress).where(eq(progress.userId, userId));
  const highest = Math.max(0, ...prog.filter((p) => p.mode !== 'showtime').map((p) => p.highestNight));
  const presets = new Set(prog.flatMap((p) => p.presetsBeaten));
  let stars = 0;
  if (highest >= 5) stars++;
  if (highest >= 6) stars++;
  if (presets.has('four_twenty')) stars++;
  if (PRESETS.every((p) => p.id === 'golden' || presets.has(p.id))) stars++;
  await db.update(users).set({ stars }).where(eq(users.id, userId));
  return stars;
}

export async function cumulativeAchievements(db: DbOrTx, userId: string): Promise<string[]> {
  const [s] = await db.select().from(stats).where(eq(stats.userId, userId));
  const owned = await ownedCosmetics(db, userId);
  const arch = await db.select().from(archiveUnlocks).where(eq(archiveUnlocks.userId, userId));
  const prog = await db.select().from(progress).where(eq(progress.userId, userId));
  const out: string[] = [];
  if (owned.length >= 25) out.push('collector');
  if (s && s.skinChanges >= 10) out.push('fashion');
  if (s && s.nightsPlayed >= 100) out.push('hundred');
  if (s && (s.deathsBy.bonnie ?? 0) >= 10) out.push('bonnie_x10');
  if (arch.filter((a) => a.kind === 'newspaper').length >= 6) out.push('newspaper');
  if (arch.some((a) => a.kind === 'character' && a.itemId === 'shadow_bonnie')) out.push('shadow_seen');
  if (arch.filter((a) => a.kind === 'minigame' && a.itemId.endsWith(':done')).length >= 3) out.push('minigame_all');
  const presets = new Set(prog.flatMap((p) => p.presetsBeaten));
  if (PRESETS.every((p) => p.id === 'golden' || presets.has(p.id))) out.push('golden_star');
  return out;
}

export async function highestNight(db: Db, userId: string, mode: string): Promise<number> {
  const [p] = await db
    .select()
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.mode, mode)));
  return p?.highestNight ?? 0;
}

export async function bumpSkinChanges(db: Db, userId: string): Promise<void> {
  await db.update(stats).set({ skinChanges: sql`${stats.skinChanges} + 1` }).where(eq(stats.userId, userId));
}

export async function usersByIds(db: Db, ids: string[]): Promise<UserRow[]> {
  if (!ids.length) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}
