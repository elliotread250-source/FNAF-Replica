import { loadEnv } from '../src/env';
import { connect, runMigrations, type DbHandle } from '../src/db/client';
import { buildApp, type App } from '../src/app';
import { resetAllLimits } from '../src/auth/ratelimit';
import { io as ioc, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/fnaf_test';

export async function freshApp(extra: Record<string, string> = {}): Promise<{ app: App; h: DbHandle; url: string }> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    SESSION_SECRET: 'test-secret-test-secret-test-secret',
    FAST_NIGHT: '1',
    TEST_SEED: '1234',
    LOG_LEVEL: 'silent',
    ...extra,
  } as NodeJS.ProcessEnv);
  const h = connect(env.DATABASE_URL);
  await h.sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await runMigrations(h);
  resetAllLimits();
  const app = await buildApp(env, h);
  await app.app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.app.server.address() as AddressInfo).port;
  return { app, h, url: `http://127.0.0.1:${port}` };
}

export interface Agent {
  cookie: string;
  req<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
}

export function agent(app: App): Agent {
  const a: Agent = {
    cookie: '',
    async req(method, path, body) {
      const res = await app.app.inject({
        method: method as 'GET',
        url: path,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(a.cookie ? { cookie: a.cookie } : {}),
        },
        payload: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const set = res.headers['set-cookie'];
      const sc = Array.isArray(set) ? set : set ? [set] : [];
      for (const c of sc) {
        const [kv] = c.split(';');
        if (kv.startsWith('fr_session=')) a.cookie = kv.endsWith('=') ? '' : kv;
      }
      return { status: res.statusCode, body: res.json() };
    },
  };
  return a;
}

export function socketFor(url: string, cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(url, { extraHeaders: { cookie }, transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

export function emitAck<T = Record<string, unknown>>(s: Socket, ev: string, payload: unknown = {}): Promise<T> {
  return new Promise((resolve) => s.emit(ev, payload, (r: T) => resolve(r)));
}

export function waitFor<T = Record<string, unknown>>(s: Socket, ev: string, pred: (p: T) => boolean = () => true, ms = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ev}`)), ms);
    const h = (p: T) => {
      if (pred(p)) {
        clearTimeout(t);
        s.off(ev, h);
        resolve(p);
      }
    };
    s.on(ev, h);
  });
}
