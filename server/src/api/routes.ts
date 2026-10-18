import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  ArchiveZ,
  BuyZ,
  COSMETICS,
  COSMETICS_BY_ID,
  DeleteMeZ,
  EquipZ,
  PasswordChangeZ,
  PatchMeZ,
  buyableToday,
  isProfane,
  shopRotation,
  slotFor,
} from '@fnaf/shared';
import { HttpError, clearSessionCookie, parseBody, requireUser, type Ctx } from '../http';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { archiveUnlocks, progress, stats, userCosmetics, users } from '../db/schema';
import {
  bumpSkinChanges,
  cumulativeAchievements,
  findByUsername,
  grantAchievements,
  grantCosmetics,
  loadMe,
  ownedCosmetics,
  publicUser,
} from '../services/users';

export interface ApiHooks {
  onEquip(userId: string): void;
  onProfileChange(userId: string): void;
}

export function registerApiRoutes(app: FastifyInstance, ctx: Ctx, hooks: ApiHooks): void {
  app.get('/api/me', async (req) => {
    const u = await requireUser(ctx, req);
    return loadMe(ctx.db, u.id);
  });

  app.patch('/api/me', async (req) => {
    const u = await requireUser(ctx, req);
    const body = parseBody(PatchMeZ, req.body);
    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.displayName !== undefined) {
      if (isProfane(body.displayName)) throw new HttpError(400, 'invalid', "That name won't fit on a badge. Pick another.");
      if (u.displayNameChangedAt && Date.now() - u.displayNameChangedAt.getTime() < 86400_000) {
        throw new HttpError(429, 'too_soon', 'You can change your display name once a day.');
      }
      patch.displayName = body.displayName;
      patch.displayNameChangedAt = new Date();
    }
    if (body.settings !== undefined) {
      if (JSON.stringify(body.settings).length > 8000) throw new HttpError(400, 'invalid', 'Settings too large.');
      patch.settings = body.settings;
    }
    const [row] = await ctx.db.update(users).set(patch).where(eq(users.id, u.id)).returning();
    if (body.displayName) hooks.onProfileChange(u.id);
    return { user: publicUser(row) };
  });

  app.put('/api/me/password', async (req) => {
    const u = await requireUser(ctx, req);
    const body = parseBody(PasswordChangeZ, req.body);
    if (!(await verifyPassword(u.passwordHash, body.current))) throw new HttpError(401, 'bad_credentials', 'Current password is wrong.');
    await ctx.db.update(users).set({ passwordHash: await hashPassword(body.next) }).where(eq(users.id, u.id));
    return { ok: true };
  });

  app.put('/api/me/equipped', async (req) => {
    const u = await requireUser(ctx, req);
    const { slot, cosmeticId } = parseBody(EquipZ, req.body);
    const c = COSMETICS_BY_ID[cosmeticId];
    if (!c || slotFor(c) !== slot) throw new HttpError(400, 'invalid', "That doesn't go there.");
    const owned = await ownedCosmetics(ctx.db, u.id);
    if (!owned.includes(cosmeticId)) throw new HttpError(403, 'not_owned', "You don't own that yet.");
    const equipped = { ...u.equipped, [slot]: cosmeticId };
    await ctx.db.update(users).set({ equipped }).where(eq(users.id, u.id));
    if (slot === 'guard' || slot === 'accessory') await bumpSkinChanges(ctx.db, u.id);
    const fresh = await grantAchievements(ctx.db, u.id, await cumulativeAchievements(ctx.db, u.id));
    hooks.onEquip(u.id);
    return { equipped, achievements: fresh };
  });

  app.delete('/api/me', async (req, reply) => {
    const u = await requireUser(ctx, req);
    const body = parseBody(DeleteMeZ, req.body);
    if (!u.isGuest && !(await verifyPassword(u.passwordHash, body.password ?? ''))) {
      throw new HttpError(401, 'bad_credentials', 'Password is wrong.');
    }
    // Cascades remove personal data; match_players.user_id is set null so match stats stay anonymised.
    await ctx.db.delete(users).where(eq(users.id, u.id));
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/me/archive', async (req) => {
    const u = await requireUser(ctx, req);
    const body = parseBody(ArchiveZ, req.body);
    await ctx.db.insert(archiveUnlocks).values({ userId: u.id, kind: body.kind, itemId: body.id }).onConflictDoNothing();
    const fresh = await grantAchievements(ctx.db, u.id, await cumulativeAchievements(ctx.db, u.id));
    if (body.kind === 'minigame' && body.id === 'lightsOn:done') await grantCosmetics(ctx.db, u.id, ['office_drawings'], 'achievement');
    return { ok: true, achievements: fresh };
  });

  app.post('/api/me/honk', async (req) => {
    const u = await requireUser(ctx, req);
    return { achievements: await grantAchievements(ctx.db, u.id, ['honk']) };
  });

  app.get('/api/cosmetics', async () => {
    const now = new Date();
    return { catalogue: COSMETICS, rotation: shopRotation(now), buyable: [...buyableToday(now)] };
  });

  app.post('/api/shop/buy', async (req) => {
    const u = await requireUser(ctx, req);
    const { cosmeticId } = parseBody(BuyZ, req.body);
    const c = COSMETICS_BY_ID[cosmeticId];
    if (!c || c.price === null || c.rarity === 'golden') throw new HttpError(400, 'not_for_sale', "That's not for sale.");
    if (!buyableToday(new Date()).has(cosmeticId)) throw new HttpError(400, 'not_today', "That's not in today's shop.");
    const price = c.price;
    const result = await ctx.db.transaction(async (tx) => {
      const [own] = await tx
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, u.id), eq(userCosmetics.cosmeticId, cosmeticId)));
      if (own) throw new HttpError(409, 'owned', 'You already own that.');
      const upd = await tx
        .update(users)
        .set({ fazTokens: sql`${users.fazTokens} - ${price}` })
        .where(and(eq(users.id, u.id), sql`${users.fazTokens} >= ${price}`))
        .returning({ fazTokens: users.fazTokens });
      if (!upd.length) throw new HttpError(402, 'too_poor', "Not enough tokens. Hazard pay: denied.");
      await tx.insert(userCosmetics).values({ userId: u.id, cosmeticId, source: 'shop' });
      return upd[0].fazTokens;
    });
    const fresh = await grantAchievements(ctx.db, u.id, await cumulativeAchievements(ctx.db, u.id));
    return { fazTokens: result, cosmetics: await ownedCosmetics(ctx.db, u.id), achievements: fresh };
  });

  app.get<{ Params: { username: string } }>('/api/profile/:username', async (req) => {
    const u = await findByUsername(ctx.db, String(req.params.username).slice(0, 32));
    if (!u || u.isGuest) throw new HttpError(404, 'not_found', 'No guard by that name.');
    const me = await loadMe(ctx.db, u.id);
    if (!me) throw new HttpError(404, 'not_found', 'No guard by that name.');
    const { email: _e, settings: _s, fazTokens: _f, ...pub } = me.user;
    return { user: pub, stats: me.stats, achievements: me.achievements, progress: me.progress };
  });

  app.get<{ Params: { board: string } }>('/api/leaderboard/:board', async (req) => {
    const board = req.params.board;
    if (board === 'nights') {
      const rows = await ctx.db
        .select({ name: users.displayName, username: users.usernameDisplay, stars: users.stars, value: stats.nightsSurvived })
        .from(users)
        .innerJoin(stats, eq(stats.userId, users.id))
        .where(eq(users.isGuest, false))
        .orderBy(desc(users.stars), desc(stats.nightsSurvived))
        .limit(50);
      return { board, rows };
    }
    if (board === 'showtime') {
      const rows = await ctx.db
        .select({ name: users.displayName, username: users.usernameDisplay, stars: users.stars, value: sql<number>`${stats.showtimeWinsAsPuppeteer} * 100 + ${stats.showtimeKills}` })
        .from(users)
        .innerJoin(stats, eq(stats.userId, users.id))
        .where(eq(users.isGuest, false))
        .orderBy(desc(sql`${stats.showtimeWinsAsPuppeteer} * 100 + ${stats.showtimeKills}`))
        .limit(50);
      return { board, rows };
    }
    if (board === 'custom') {
      const rows = await ctx.db
        .select({ name: users.displayName, username: users.usernameDisplay, stars: users.stars, value: sql<number>`cardinality(${progress.presetsBeaten})` })
        .from(users)
        .innerJoin(progress, and(eq(progress.userId, users.id), eq(progress.mode, 'nightshift')))
        .where(eq(users.isGuest, false))
        .orderBy(desc(sql`cardinality(${progress.presetsBeaten})`), desc(users.stars))
        .limit(50);
      return { board, rows };
    }
    throw new HttpError(404, 'not_found', 'No such board.');
  });

  app.get('/api/config', async () => ({
    rosterMode: ctx.env.ROSTER_MODE,
    smtp: ctx.env.smtpEnabled,
    fastNight: ctx.env.fastNight,
    testHooks: ctx.env.testHooks,
    ice: [
      { urls: 'stun:stun.l.google.com:19302' },
      ...(ctx.env.TURN_URL ? [{ urls: ctx.env.TURN_URL, username: ctx.env.TURN_USERNAME, credential: ctx.env.TURN_CREDENTIAL }] : []),
    ],
  }));

}
