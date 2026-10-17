import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import fstatic from '@fastify/static';
import { Server as IOServer } from 'socket.io';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql as dsql } from 'drizzle-orm';
import type { Env } from './env';
import type { DbHandle } from './db/client';
import { HttpError, type Ctx } from './http';
import { registerAuthRoutes } from './auth/routes';
import { registerApiRoutes } from './api/routes';
import { LobbyManager } from './game/lobbyManager';
import { COOKIE, userForToken } from './auth/sessions';
import { relaxSignupLimits } from './auth/ratelimit';

export const VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const p of [join(here, '../../package.json'), join(here, '../package.json'), join(process.cwd(), 'package.json')]) {
      if (existsSync(p)) return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
    }
  } catch {
    /* fall through */
  }
  return '0.0.0';
})();

function clientDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [resolve(here, '../../client/dist'), resolve(here, '../client/dist'), resolve(process.cwd(), 'client/dist')]) {
    if (existsSync(join(p, 'index.html'))) return p;
  }
  return null;
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export interface App {
  app: FastifyInstance;
  io: IOServer;
  lobbies: LobbyManager;
  close(): Promise<void>;
}

export async function buildApp(env: Env, h: DbHandle): Promise<App> {
  const app = Fastify({
    trustProxy: true,
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
    bodyLimit: 64 * 1024,
  });
  const ctx: Ctx = { env, db: h.db };
  if (!env.isProd) relaxSignupLimits();
  const started = Date.now();

  await app.register(cookie);

  // Security headers on every response.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: data:",
        "connect-src 'self' ws: wss:",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'",
      ].join('; '),
    );
    return payload;
  });

  // CSRF: state-changing API calls need JSON and a same-origin Origin header.
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/') || req.method === 'GET' || req.method === 'HEAD') return;
    const ct = req.headers['content-type'] ?? '';
    if (!ct.startsWith('application/json')) throw new HttpError(415, 'json_only', 'Send JSON.');
    const origin = req.headers.origin;
    if (origin) {
      const allowed = new Set<string>();
      if (env.PUBLIC_URL) allowed.add(new URL(env.PUBLIC_URL).origin);
      const host = req.headers['x-forwarded-host'] ?? req.headers.host;
      if (host) {
        allowed.add(`https://${host}`);
        allowed.add(`http://${host}`);
      }
      if (!allowed.has(origin)) throw new HttpError(403, 'bad_origin', 'Cross-site request blocked.');
    } else if (env.isProd) {
      throw new HttpError(403, 'bad_origin', 'Missing Origin header.');
    }
  });

  // Fastify rejects empty JSON bodies by default; treat them as {}.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && !body.trim())) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new HttpError(400, 'invalid', 'Bad JSON.'), undefined);
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: { code: status >= 500 ? 'server' : 'bad_request', message: status >= 500 ? 'Something broke in the back.' : err.message } });
  });

  app.get('/healthz', async (_req, reply) => {
    let db = 'ok';
    try {
      await h.db.execute(dsql`select 1`);
    } catch {
      db = 'down';
    }
    if (db !== 'ok') reply.status(503);
    return { ok: db === 'ok', uptime: Math.round((Date.now() - started) / 1000), version: VERSION, db };
  });

  const io = new IOServer(app.server, { serveClient: false, cors: { origin: false }, maxHttpBufferSize: 64 * 1024 });
  const lobbies = new LobbyManager(io, h.db, env, app.log);

  registerAuthRoutes(app, ctx);
  registerApiRoutes(app, ctx, {
    onEquip: (uid) => void lobbies.refreshPlayer(uid),
    onProfileChange: (uid) => void lobbies.refreshPlayer(uid),
  });

  // Socket.IO shares the session cookie: no separate token dance.
  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, COOKIE);
      const user = await userForToken(h.db, env.SESSION_SECRET, token);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch (err) {
      next(err as Error);
    }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user;
    void lobbies.onConnect(socket, user);
    socket.onAny((event: string, payload: unknown, ack?: unknown) => {
      const cb = typeof ack === 'function' ? (ack as (r: unknown) => void) : typeof payload === 'function' ? (payload as (r: unknown) => void) : undefined;
      const body = typeof payload === 'function' ? {} : payload;
      lobbies.handle(socket, user, event, body, cb).catch((err: unknown) => app.log.error({ err }, 'socket handler failed'));
    });
    socket.on('disconnect', () => lobbies.onDisconnect(user.id));
  });

  // Static client with an SPA fallback.
  const dist = clientDist();
  if (dist) {
    await app.register(fstatic, {
      root: dist,
      wildcard: false,
      setHeaders(res, path) {
        if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        else if (path.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
    const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
    app.setNotFoundHandler((req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Nothing here.' } });
      }
      const p = req.url.split('?')[0];
      const file = join(dist, p);
      if (p !== '/' && file.startsWith(dist) && existsSync(file) && !p.endsWith('/')) return reply.sendFile(p.slice(1));
      return reply.type('text/html').header('Cache-Control', 'no-cache').send(indexHtml);
    });
  } else {
    app.get('/', async (_req, reply) =>
      reply.type('text/html').send('<!doctype html><title>FNAF Replica</title><p>Client not built. Run <code>npm run build</code>.</p>'),
    );
  }

  return {
    app,
    io,
    lobbies,
    async close() {
      lobbies.stopTimers();
      io.close();
      await app.close();
    },
  };
}
