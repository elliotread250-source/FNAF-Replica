import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { CONFIG } from '@fnaf/shared';
import { agent, emitAck, freshApp, socketFor, waitFor } from './setup';
import type { App } from '../src/app';
import type { DbHandle } from '../src/db/client';
import { users } from '../src/db/schema';
import { persistMatch } from '../src/game/rewards';
import type { Socket } from 'socket.io-client';

let app: App;
let h: DbHandle;
let url: string;

beforeAll(async () => {
  ({ app, h, url } = await freshApp());
});
afterAll(async () => {
  await app.close();
  await h.close();
});

describe('auth', () => {
  it('signs up, logs out, logs back in', async () => {
    const a = agent(app);
    const s = await a.req('POST', '/api/auth/signup', { username: 'Guard_One', password: 'hunter2hunter2' });
    expect(s.status).toBe(200);
    expect(a.cookie).toMatch(/^fr_session=/);
    const me = await a.req<{ user: { username: string }; cosmetics: string[] }>('GET', '/api/me');
    expect(me.body.user.username).toBe('Guard_One');
    expect(me.body.cosmetics).toContain('guard_classic_blue');
    await a.req('POST', '/api/auth/logout', {});
    expect((await a.req('GET', '/api/me')).status).toBe(401);
    const l = await a.req('POST', '/api/auth/login', { username: 'guard_one', password: 'hunter2hunter2' });
    expect(l.status).toBe(200);
    expect((await a.req('GET', '/api/me')).status).toBe(200);
  });

  it('rejects duplicate usernames (case-insensitive) and reserved names', async () => {
    const a = agent(app);
    expect((await a.req('POST', '/api/auth/signup', { username: 'GUARD_ONE', password: 'xxxxxxxxxx' })).status).toBe(409);
    expect((await a.req('POST', '/api/auth/signup', { username: 'admin', password: 'xxxxxxxxxx' })).status).toBe(400);
  });

  it('wrong passwords are rejected and rate limited per username', async () => {
    const a = agent(app);
    await a.req('POST', '/api/auth/signup', { username: 'locked_out', password: 'correct-horse' });
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await a.req('POST', '/api/auth/login', { username: 'locked_out', password: 'nope' })).status);
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it('creates a guest and claims it, keeping everything', async () => {
    const a = agent(app);
    const g = await a.req<{ user: { username: string; isGuest: boolean; id: string } }>('POST', '/api/auth/guest', {});
    expect(g.body.user.isGuest).toBe(true);
    expect(g.body.user.username).toMatch(/^Guest_\d+/);
    await h.db.update(users).set({ fazTokens: 77 }).where(eq(users.id, g.body.user.id));
    const c = await a.req<{ user: { isGuest: boolean; username: string; fazTokens: number } }>('POST', '/api/auth/claim', { username: 'Claimed_Guy', password: 'claimclaim' });
    expect(c.status).toBe(200);
    expect(c.body.user.isGuest).toBe(false);
    expect(c.body.user.fazTokens).toBe(77);
    const b = agent(app);
    expect((await b.req('POST', '/api/auth/login', { username: 'claimed_guy', password: 'claimclaim' })).status).toBe(200);
  });

  it('expired sessions stop working', async () => {
    const a = agent(app);
    await a.req('POST', '/api/auth/signup', { username: 'expiring', password: 'xxxxxxxxxx' });
    await h.sql`update sessions set expires_at = now() - interval '1 minute'`;
    expect((await a.req('GET', '/api/me')).status).toBe(401);
  });

  it('blocks cross-site state changes', async () => {
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(403);
  });

  it('forgot-password explains when SMTP is missing', async () => {
    const r = await agent(app).req<{ error: { message: string } }>('POST', '/api/auth/forgot', { email: 'x@y.z' });
    expect(r.status).toBe(501);
    expect(r.body.error.message).toMatch(/isn't set up/);
  });

  it('healthz reports ok', async () => {
    const r = await agent(app).req<{ ok: boolean; db: string }>('GET', '/healthz');
    expect(r.status).toBe(200);
    expect(r.body.db).toBe('ok');
  });
});

describe('cosmetics and shop', () => {
  it('equipping an owned skin works; an unowned one fails', async () => {
    const a = agent(app);
    await a.req('POST', '/api/auth/signup', { username: 'fashionista', password: 'xxxxxxxxxx' });
    const ok = await a.req<{ equipped: Record<string, string> }>('PUT', '/api/me/equipped', { slot: 'guard', cosmeticId: 'guard_graveyard_grey' });
    expect(ok.status).toBe(200);
    expect(ok.body.equipped.guard).toBe('guard_graveyard_grey');
    const bad = await a.req('PUT', '/api/me/equipped', { slot: 'guard', cosmeticId: 'guard_purple_night' });
    expect(bad.status).toBe(403);
    const wrongSlot = await a.req('PUT', '/api/me/equipped', { slot: 'tablet', cosmeticId: 'guard_graveyard_grey' });
    expect(wrongSlot.status).toBe(400);
  });

  it('buying with enough tokens succeeds in a transaction; without enough it fails and the balance stays put', async () => {
    const a = agent(app);
    const s = await a.req<{ user: { id: string } }>('POST', '/api/auth/signup', { username: 'shopper', password: 'xxxxxxxxxx' });
    const id = s.body.user.id;
    const poor = await a.req<{ error: { code: string } }>('POST', '/api/shop/buy', { cosmeticId: 'guard_midnight_black' });
    expect(poor.status).toBe(402);
    const [u0] = await h.db.select().from(users).where(eq(users.id, id));
    expect(u0.fazTokens).toBe(0);
    await h.db.update(users).set({ fazTokens: 200 }).where(eq(users.id, id));
    const ok = await a.req<{ fazTokens: number; cosmetics: string[] }>('POST', '/api/shop/buy', { cosmeticId: 'guard_midnight_black' });
    expect(ok.status).toBe(200);
    expect(ok.body.fazTokens).toBe(50);
    expect(ok.body.cosmetics).toContain('guard_midnight_black');
    expect((await a.req('POST', '/api/shop/buy', { cosmeticId: 'guard_midnight_black' })).status).toBe(409);
    const golden = await a.req('POST', '/api/shop/buy', { cosmeticId: 'guard_golden' });
    expect(golden.status).toBe(400);
  });
});

describe('rewards', () => {
  it('match end awards tokens exactly per Part 8.6', async () => {
    const a = agent(app);
    const s = await a.req<{ user: { id: string } }>('POST', '/api/auth/signup', { username: 'paid_guard', password: 'xxxxxxxxxx' });
    const uid = s.body.user.id;
    const base = { cameraChecks: 1, doorsClosed: 1, tabletSeconds: 1, powerUsed: 1, closeCalls: 0, ghostSeconds: 0 };
    const r = {
      mode: 'nightshift' as const,
      night: 3,
      result: 'win' as const,
      hour: 6,
      power: 20,
      seed: 1,
      presetId: null,
      players: [{ pid: uid, station: 'west' as const, role: 'guard' as const, survived: true, ghost: false, killedBy: null, deathHour: null, tokens: 100, achievements: ['first_shift'], stats: base, presetBeaten: null }],
    };
    const out = await persistMatch(h.db, r, { startedAt: new Date(), players: [{ pid: uid, userId: uid, isBot: false }], customAi: null, seconds: 30 });
    expect(out[uid].tokens).toBe(100 + CONFIG.rewards.FIRST_WIN_OF_DAY);
    const out2 = await persistMatch(h.db, r, { startedAt: new Date(), players: [{ pid: uid, userId: uid, isBot: false }], customAi: null, seconds: 30 });
    expect(out2[uid].tokens).toBe(100);
    const me = await a.req<{ user: { fazTokens: number }; progress: Record<string, { highestNight: number }>; stats: { nights_survived: number } }>('GET', '/api/me');
    expect(me.body.user.fazTokens).toBe(300);
    expect(me.body.progress.nightshift.highestNight).toBe(3);
    expect(me.body.stats.nights_survived).toBe(2);
  });
});

describe('four sockets play a FAST_NIGHT', () => {
  it('create, join by code, ready, start, play inputs and all receive the same night:end', async () => {
    const agents = await Promise.all(
      [0, 1, 2, 3].map(async (i) => {
        const a = agent(app);
        await a.req('POST', '/api/auth/signup', { username: `sock_${i}`, password: 'xxxxxxxxxx' });
        return a;
      }),
    );
    const socks: Socket[] = await Promise.all(agents.map((a) => socketFor(url, a.cookie)));
    const created = await emitAck<{ code: string }>(socks[0], 'lobby:create', { mode: 'nightshift', night: 1 });
    expect(created.code).toMatch(/^[A-Z]{4}$/);
    for (let i = 1; i < 4; i++) {
      const j = await emitAck<{ code: string }>(socks[i], 'lobby:join', { code: created.code.toLowerCase() });
      expect(j.code).toBe(created.code);
    }
    const stations = ['west', 'east', 'south', 'control'];
    for (let i = 0; i < 4; i++) socks[i].emit('lobby:station', { station: stations[i] });
    const full = waitFor<{ players: { ready: boolean }[] }>(socks[0], 'lobby:state', (s) => s.players.length === 4 && s.players.filter((p) => p.ready).length === 3);
    for (let i = 1; i < 4; i++) socks[i].emit('lobby:ready', { ready: true });
    await full;
    const starts = socks.map((s) => waitFor<{ you: string; night: number }>(s, 'night:start'));
    const ends = socks.map((s) => waitFor<{ result: string; hour: number; rewards: { tokens: number } }>(s, 'night:end', () => true, 60000));
    const r = await emitAck<{ ok?: boolean; error?: unknown }>(socks[0], 'lobby:start');
    expect(r.ok).toBe(true);
    const st = await Promise.all(starts);
    expect(new Set(st.map((x) => x.you)).size).toBe(4);
    // Play a little: each raises the tablet, flips a camera, lowers it, toggles a door.
    await new Promise((res) => setTimeout(res, 2000));
    let seq = 1;
    for (let i = 0; i < 4; i++) {
      socks[i].emit('input', { seq: seq++, input: { action: 'tablet', up: true } });
      socks[i].emit('input', { seq: seq++, input: { action: 'camera', node: 'dining' } });
      socks[i].emit('input', { seq: seq++, input: { action: 'tablet', up: false } });
    }
    socks[0].emit('input', { seq: seq++, input: { action: 'door', door: 'west', closed: true } });
    const snap = await waitFor<{ v?: { doors: Record<string, { c: boolean }> } }>(socks[1], 'snap', (s) => Boolean(s.v?.doors.west.c));
    expect(snap.v?.doors.west.c).toBe(true);
    socks[0].emit('input', { seq: seq++, input: { action: 'door', door: 'west', closed: false } });
    const results = await Promise.all(ends);
    expect(new Set(results.map((x) => x.result)).size).toBe(1);
    expect(results[0].result).toBe('win');
    expect(results.every((x) => x.rewards.tokens > 0)).toBe(true);
    const me = await agents[2].req<{ stats: { nights_survived: number } }>('GET', '/api/me');
    expect(me.body.stats.nights_survived).toBe(1);
    socks.forEach((s) => s.close());
  }, 90000);

  it('bad room codes get a friendly error', async () => {
    const a = agent(app);
    await a.req('POST', '/api/auth/signup', { username: 'lost_guard', password: 'xxxxxxxxxx' });
    const s = await socketFor(url, a.cookie);
    const r = await emitAck<{ error: { message: string } }>(s, 'lobby:join', { code: 'ZZZZ' });
    expect(r.error.message).toMatch(/Couldn't find that room/);
    s.close();
  });
});
