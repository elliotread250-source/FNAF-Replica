import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { ForgotZ, LoginZ, ResetZ, SignupZ, isProfane } from '@fnaf/shared';
import { HttpError, clearSessionCookie, currentUser, parseBody, setSessionCookie, type Ctx } from '../http';
import { hashPassword, verifyPassword } from './passwords';
import { limits } from './ratelimit';
import { COOKIE, createSession, destroySession } from './sessions';
import { createUser, findByUsername, publicUser } from '../services/users';
import { passwordResets, users } from '../db/schema';

function tooMany(): HttpError {
  return new HttpError(429, 'rate_limited', 'Slow down. Too many attempts, try again in a bit.');
}

export function registerAuthRoutes(app: FastifyInstance, ctx: Ctx): void {
  app.post('/api/auth/signup', async (req, reply) => {
    if (limits.signupIp.hit(`signup:${req.ip}`)) throw tooMany();
    const body = parseBody(SignupZ, req.body);
    if (isProfane(body.username)) throw new HttpError(400, 'invalid', "That name won't fit on a badge. Pick another.");
    if (await findByUsername(ctx.db, body.username)) throw new HttpError(409, 'taken', 'That username is taken.');
    if (body.email) {
      const [e] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
      if (e) throw new HttpError(409, 'email_taken', 'That email is already on file.');
    }
    const u = await createUser(ctx.db, {
      username: body.username,
      displayName: body.username,
      passwordHash: await hashPassword(body.password),
      email: body.email?.toLowerCase() ?? null,
      isGuest: false,
    });
    const s = await createSession(ctx.db, ctx.env.SESSION_SECRET, u.id, req.headers['user-agent']);
    setSessionCookie(ctx, reply, s.token, s.expires);
    return { user: publicUser(u) };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = parseBody(LoginZ, req.body);
    if (limits.loginIp.hit(`login:${req.ip}`) || limits.loginUser.hit(`login:${body.username.toLowerCase()}`)) throw tooMany();
    const u = await findByUsername(ctx.db, body.username);
    const ok = u && !u.isGuest ? await verifyPassword(u.passwordHash, body.password) : false;
    if (!u || !ok) throw new HttpError(401, 'bad_credentials', "That username and password don't match.");
    const s = await createSession(ctx.db, ctx.env.SESSION_SECRET, u.id, req.headers['user-agent']);
    setSessionCookie(ctx, reply, s.token, s.expires);
    return { user: publicUser(u) };
  });

  app.post('/api/auth/guest', async (req, reply) => {
    if (limits.guestIp.hit(`guest:${req.ip}`)) throw tooMany();
    let u = null;
    for (let i = 0; i < 5 && !u; i++) {
      const n = `Guest_${Math.floor(1000 + Math.random() * 9000)}${i ? i : ''}`;
      if (await findByUsername(ctx.db, n)) continue;
      u = await createUser(ctx.db, { username: n, displayName: n, passwordHash: null, isGuest: true });
    }
    if (!u) throw new HttpError(503, 'busy', 'Try again.');
    const s = await createSession(ctx.db, ctx.env.SESSION_SECRET, u.id, req.headers['user-agent']);
    setSessionCookie(ctx, reply, s.token, s.expires);
    return { user: publicUser(u) };
  });

  app.post('/api/auth/claim', async (req) => {
    const me = await currentUser(ctx, req);
    if (!me) throw new HttpError(401, 'unauthorized', 'Clock in first.');
    if (!me.isGuest) throw new HttpError(400, 'not_guest', 'This account is already claimed.');
    const body = parseBody(SignupZ, req.body);
    if (isProfane(body.username)) throw new HttpError(400, 'invalid', "That name won't fit on a badge. Pick another.");
    const existing = await findByUsername(ctx.db, body.username);
    if (existing && existing.id !== me.id) throw new HttpError(409, 'taken', 'That username is taken.');
    const [u] = await ctx.db
      .update(users)
      .set({
        username: body.username.toLowerCase(),
        usernameDisplay: body.username,
        displayName: body.username,
        passwordHash: await hashPassword(body.password),
        email: body.email?.toLowerCase() ?? null,
        isGuest: false,
      })
      .where(eq(users.id, me.id))
      .returning();
    return { user: publicUser(u) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(ctx.db, ctx.env.SESSION_SECRET, req.cookies[COOKIE]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/auth/forgot', async (req) => {
    if (!ctx.env.smtpEnabled) throw new HttpError(501, 'no_smtp', "Password reset isn't set up on this server yet.");
    if (limits.forgotIp.hit(`forgot:${req.ip}`)) throw tooMany();
    const { email } = parseBody(ForgotZ, req.body);
    const [u] = await ctx.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (u) {
      const token = randomBytes(32).toString('base64url');
      await ctx.db.insert(passwordResets).values({
        userId: u.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
      const link = `${ctx.env.PUBLIC_URL ?? ''}/?reset=${token}`;
      const t = nodemailer.createTransport({
        host: ctx.env.SMTP_HOST,
        port: ctx.env.SMTP_PORT,
        auth: ctx.env.SMTP_USER ? { user: ctx.env.SMTP_USER, pass: ctx.env.SMTP_PASS } : undefined,
      });
      t.sendMail({
        from: ctx.env.MAIL_FROM,
        to: u.email ?? undefined,
        subject: 'FNAF Replica password reset',
        text: `Someone asked to reset your password. If it was you, open this link within an hour:\n\n${link}\n\nIf it wasn't, ignore this.`,
      }).catch((err: unknown) => app.log.warn({ err }, 'reset mail failed'));
    }
    return { ok: true };
  });

  app.post('/api/auth/reset', async (req) => {
    const body = parseBody(ResetZ, req.body);
    const th = createHash('sha256').update(body.token).digest('hex');
    const [r] = await ctx.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, th), gt(passwordResets.expiresAt, new Date()), isNull(passwordResets.usedAt)))
      .limit(1);
    if (!r) throw new HttpError(400, 'bad_token', 'That reset link has expired.');
    await ctx.db.update(users).set({ passwordHash: await hashPassword(body.password) }).where(eq(users.id, r.userId));
    await ctx.db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
    return { ok: true };
  });
}
