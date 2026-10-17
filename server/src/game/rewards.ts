import { and, eq, gte, sql } from 'drizzle-orm';
import { CONFIG, PRESETS, type MatchResult } from '@fnaf/shared';
import type { Db } from '../db/client';
import { matchPlayers, matches, progress, stats, users } from '../db/schema';
import { cumulativeAchievements, grantAchievements, grantCosmetics, recomputeStars } from '../services/users';

export interface RewardPlayer {
  pid: string;
  userId: string | null;
  isBot: boolean;
}

export interface PlayerReward {
  pid: string;
  tokens: number;
  firstWinBonus: number;
  newAchievements: string[];
  newCosmetics: string[];
  balance: number;
}

/** Persist a finished match and pay everyone. All writes per player happen in one transaction. */
export async function persistMatch(
  db: Db,
  r: MatchResult,
  meta: { startedAt: Date; players: RewardPlayer[]; customAi: unknown; abandoned?: boolean; seconds: number },
): Promise<Record<string, PlayerReward>> {
  const [m] = await db
    .insert(matches)
    .values({
      mode: r.mode,
      night: r.night,
      seed: r.seed,
      customAi: meta.customAi ?? null,
      playerCount: meta.players.filter((p) => !p.isBot).length,
      result: meta.abandoned ? 'abandoned' : r.result,
      endedAtHour: r.hour,
      powerLeft: r.power,
      startedAt: meta.startedAt,
      endedAt: new Date(),
    })
    .returning({ id: matches.id });

  const out: Record<string, PlayerReward> = {};
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  for (const pr of r.players) {
    const meta2 = meta.players.find((p) => p.pid === pr.pid);
    const userId = meta2 && !meta2.isBot ? meta2.userId : null;
    const station = pr.station ?? (pr.role === 'puppeteer' ? 'puppeteer' : `x_${pr.pid.slice(0, 8)}`);
    if (meta.abandoned) {
      await db.insert(matchPlayers).values({ matchId: m.id, userId, station, survived: false, killedBy: null, deathHour: null, tokensEarned: 0 }).onConflictDoNothing();
      continue;
    }
    if (!userId) {
      await db
        .insert(matchPlayers)
        .values({ matchId: m.id, userId: null, station, survived: pr.survived, killedBy: pr.killedBy, deathHour: pr.deathHour, tokensEarned: 0 })
        .onConflictDoNothing();
      continue;
    }

    out[pr.pid] = await db.transaction(async (tx) => {
      let bonus = 0;
      const won = pr.role === 'puppeteer' ? r.result === 'loss' : r.result === 'win';
      if (won) {
        const prior = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(matchPlayers)
          .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
          .where(and(eq(matchPlayers.userId, userId), gte(matches.endedAt, startOfDay), eq(matchPlayers.survived, true)));
        if ((prior[0]?.n ?? 0) === 0) bonus = CONFIG.rewards.FIRST_WIN_OF_DAY;
      }
      const tokens = pr.tokens + bonus;
      await tx.insert(matchPlayers).values({
        matchId: m.id,
        userId,
        station,
        survived: pr.survived,
        killedBy: pr.killedBy,
        deathHour: pr.deathHour,
        tokensEarned: tokens,
      });
      const [bal] = await tx
        .update(users)
        .set({ fazTokens: sql`${users.fazTokens} + ${tokens}` })
        .where(eq(users.id, userId))
        .returning({ fazTokens: users.fazTokens });

      const killed = pr.killedBy && pr.role === 'guard';
      await tx
        .update(stats)
        .set({
          nightsPlayed: sql`${stats.nightsPlayed} + 1`,
          nightsSurvived: sql`${stats.nightsSurvived} + ${pr.survived && pr.role === 'guard' ? 1 : 0}`,
          deaths: sql`${stats.deaths} + ${killed ? 1 : 0}`,
          deathsBy: killed
            ? sql`jsonb_set(${stats.deathsBy}, ${`{${pr.killedBy}}`}::text[], (coalesce((${stats.deathsBy}->>${pr.killedBy})::int, 0) + 1)::text::jsonb)`
            : sql`${stats.deathsBy}`,
          cameraChecks: sql`${stats.cameraChecks} + ${pr.stats.cameraChecks}`,
          doorsClosed: sql`${stats.doorsClosed} + ${pr.stats.doorsClosed}`,
          powerUsedTotal: sql`${stats.powerUsedTotal} + ${pr.stats.powerUsed}`,
          playtimeSeconds: sql`${stats.playtimeSeconds} + ${Math.round(meta.seconds)}`,
          showtimeWinsAsPuppeteer: sql`${stats.showtimeWinsAsPuppeteer} + ${pr.role === 'puppeteer' && won ? 1 : 0}`,
          showtimeKills: sql`${stats.showtimeKills} + ${pr.role === 'puppeteer' ? r.players.filter((p) => p.role === 'guard' && p.killedBy).length : 0}`,
        })
        .where(eq(stats.userId, userId));

      const newCosmetics: string[] = [];
      // Progress: a team win unlocks the next night for everyone in it, ghosts included.
      if (r.result === 'win' && pr.role === 'guard') {
        const mode = r.mode === 'classic' ? 'classic' : r.mode === 'showtime' ? 'showtime' : 'nightshift';
        if (r.night <= 6) {
          await tx
            .update(progress)
            .set({ highestNight: sql`greatest(${progress.highestNight}, ${r.night})` })
            .where(and(eq(progress.userId, userId), eq(progress.mode, mode)));
        }
        if (pr.presetBeaten) {
          await tx
            .update(progress)
            .set({ presetsBeaten: sql`array(select distinct unnest(${progress.presetsBeaten} || array[${pr.presetBeaten}]::text[]))` })
            .where(and(eq(progress.userId, userId), eq(progress.mode, 'nightshift')));
          const preset = PRESETS.find((p) => p.id === pr.presetBeaten);
          if (preset) newCosmetics.push(...(await grantCosmetics(tx, userId, preset.reward, 'preset')));
        }
        if (r.night === 6 || (pr.achievements.includes('cipher') && pr.survived)) {
          newCosmetics.push(...(await grantCosmetics(tx, userId, ['guard_retro_1987'], 'achievement')));
        }
      }
      if (pr.killedBy === 'golden' && r.presetId === 'golden') {
        newCosmetics.push(...(await grantCosmetics(tx, userId, ['office_golden_hour'], 'preset')));
      }
      const fresh = await grantAchievements(tx, userId, pr.achievements);
      await recomputeStars(tx, userId);
      fresh.push(...(await grantAchievements(tx, userId, await cumulativeAchievements(tx, userId))));
      return { pid: pr.pid, tokens, firstWinBonus: bonus, newAchievements: fresh, newCosmetics, balance: bal?.fazTokens ?? 0 };
    });
  }
  return out;
}
