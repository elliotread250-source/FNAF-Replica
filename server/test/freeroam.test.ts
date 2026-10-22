import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import { IDLE_CMD, levelChecksum, type FrSnap, type FrStart } from '@fnaf/shared';
import { agent, emitAck, freshApp, socketFor, waitFor } from './setup';
import type { App } from '../src/app';
import type { DbHandle } from '../src/db/client';

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

describe('free-roam multiplayer', () => {
  it('four sockets join by code, move, see each other and doors, and all get the same night:end', async () => {
    const agents = await Promise.all(
      [0, 1, 2, 3].map(async (i) => {
        const a = agent(app);
        await a.req('POST', '/api/auth/signup', { username: `roam_${i}`, password: 'xxxxxxxxxx' });
        return a;
      }),
    );
    const socks: Socket[] = await Promise.all(agents.map((a) => socketFor(url, a.cookie)));
    const created = await emitAck<{ code: string }>(socks[0], 'lobby:create', { mode: 'freeroam', night: 1 });
    for (let i = 1; i < 4; i++) await emitAck(socks[i], 'lobby:join', { code: created.code });
    const full = waitFor<{ players: { ready: boolean }[] }>(socks[0], 'lobby:state', (s) => s.players.length === 4 && s.players.filter((p) => p.ready).length === 3);
    for (let i = 1; i < 4; i++) socks[i].emit('lobby:ready', { ready: true });
    await full;
    const starts = socks.map((s) => waitFor<FrStart>(s, 'fr:start'));
    const ends = socks.map((s) => waitFor<{ result: string; mode: string; rewards: { tokens: number } }>(s, 'night:end', () => true, 90000));
    const r = await emitAck<{ ok?: boolean }>(socks[0], 'lobby:start');
    expect(r.ok).toBe(true);
    const st = await Promise.all(starts);
    expect(new Set(st.map((s) => s.you)).size).toBe(4);
    expect(st[0].players.length).toBe(4);
    // Every client is told which building the server simulates, so a stale bundle can reload.
    for (const s of st) expect(s.layout).toBe(levelChecksum());
    const me0 = st[0].you;

    // Player 0 walks north for a second (30 commands); player 1 watches the snapshots.
    const first = await waitFor<FrSnap>(socks[1], 'fr:snap');
    const startPos = first.players.find((p) => p.id === me0);
    expect(startPos).toBeDefined();
    for (let seq = 1; seq <= 30; seq++) socks[0].emit('fr:cmd', { seq, cmd: { ...IDLE_CMD, fwd: 1, yaw: 0 } });
    const moved = await waitFor<FrSnap>(socks[1], 'fr:snap', (s) => {
      const p = s.players.find((q) => q.id === me0);
      return Boolean(p && startPos && Math.hypot(p.x - startPos.x, p.z - startPos.z) > 1);
    });
    expect(moved).toBeDefined();
    // Acks come back for the mover.
    const acked = await waitFor<FrSnap>(socks[0], 'fr:snap', (s) => s.ack >= 30);
    expect(acked.ack).toBe(30);

    // Speed hack: a flood of commands is dropped, never moving faster than sprint.
    const before = acked.me.body.z;
    for (let seq = 31; seq <= 400; seq++) socks[0].emit('fr:cmd', { seq, cmd: { ...IDLE_CMD, fwd: 1, sprint: true, yaw: 0 } });
    await new Promise((res) => setTimeout(res, 1000));
    const after = await waitFor<FrSnap>(socks[0], 'fr:snap');
    expect(Math.abs(after.me.body.z - before)).toBeLessThan(5.0 * 1.4 + 1);

    // Interest management: a roaming animatronic is only sent within 35 m (ones at home are public knowledge).
    expect(after.agents.filter((a) => a.s !== 'DORMANT' && a.s !== 'COVE').every((a) => Math.hypot(a.x - after.me.body.x, a.z - after.me.body.z) <= 35)).toBe(true);

    const results = await Promise.all(ends);
    expect(new Set(results.map((x) => x.result)).size).toBe(1);
    expect(results[0].mode).toBe('freeroam');
    expect(results.every((x) => x.rewards.tokens > 0)).toBe(true);
    socks.forEach((s) => s.close());
  }, 120000);
});
