import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodSchema } from 'zod';
import type { Env } from './env';
import type { Db } from './db/client';
import { COOKIE, userForToken, type SessionUser } from './auth/sessions';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, 'invalid', first?.message ?? 'Invalid request.');
  }
  return r.data;
}

export interface Ctx {
  env: Env;
  db: Db;
}

export async function currentUser(ctx: Ctx, req: FastifyRequest): Promise<SessionUser | null> {
  const cached = (req as FastifyRequest & { _user?: SessionUser | null })._user;
  if (cached !== undefined) return cached;
  const u = await userForToken(ctx.db, ctx.env.SESSION_SECRET, req.cookies[COOKIE]);
  (req as FastifyRequest & { _user?: SessionUser | null })._user = u;
  return u;
}

export async function requireUser(ctx: Ctx, req: FastifyRequest): Promise<SessionUser> {
  const u = await currentUser(ctx, req);
  if (!u) throw new HttpError(401, 'unauthorized', 'Clock in first.');
  return u;
}

export function setSessionCookie(ctx: Ctx, reply: FastifyReply, token: string, expires: Date): void {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    secure: ctx.env.isProd,
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE, { path: '/' });
}
