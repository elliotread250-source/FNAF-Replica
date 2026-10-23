import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

// Two guards walk real routes (held keys, real collision) while the server shapes one guard's traffic: 50, 120 and
// 250 ms of one-way lag with jitter, then 120 ms with periodic stalls (how packet loss looks on a TCP link), then a
// forced reconnect. After each run the predicted position has to match the server's, the other guard has to see
// it in the same place, and at no sampled moment may the predicted body be inside anything solid.
// Shaping is a TEST_HOOKS-only server feature (fr:net); production never sees it.

type Fr = {
  debug: {
    hideUi(): void;
    teleport(x: number, z: number, y?: number, yaw?: number, pitch?: number): void;
    state(): { x: number; y: number; z: number; room: string | null };
    server(): { x: number; y: number; z: number } | null;
    inWall(): boolean;
    net(p: { lagMs: number; jitterMs: number; stallEveryMs: number; stallMs: number }): Promise<unknown>;
    drop(): void;
    holdClock(hold: boolean): Promise<unknown>;
    remotes(): string[];
  };
  myId: string;
  sim: { players: Map<string, { body: { x: number; z: number } }> };
};

const opened: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(opened.splice(0).map((c) => c.close().catch(() => {})));
});

async function signUp(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  opened.push(ctx);
  const page = await ctx.newPage();
  await page.goto('/?perf=low');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Clock In' }).click();
  await page.locator('#to-signup').click();
  await page.locator('input[name=username]').fill(name);
  await page.locator('input[name=password]').fill('night-guard-pass');
  await page.locator('#auth-submit').click();
  await expect(page.getByRole('button', { name: 'Locker Room' })).toBeVisible();
  return page;
}

/**
 * Hold keys for `ms`, sampling every 100 ms whether the predicted body is inside a wall and how far prediction
 * runs ahead of the last server position (which grows with the round trip: proof the shaping is in effect).
 */
async function hold(p: Page, keys: string[], ms: number): Promise<{ hits: number; lead: number }> {
  for (const k of keys) await p.keyboard.down(k);
  let hits = 0;
  let lead = 0;
  for (let t = 0; t < ms; t += 100) {
    const s = await p.evaluate(() => {
      const d = (globalThis as unknown as { __fr: Fr }).__fr.debug;
      const me = d.state();
      const sv = d.server();
      return { wall: d.inWall(), lead: sv ? Math.hypot(me.x - sv.x, me.z - sv.z) : 0 };
    });
    if (s.wall) hits++;
    lead = Math.max(lead, s.lead);
    await p.waitForTimeout(100);
  }
  for (const k of keys) await p.keyboard.up(k);
  return { hits, lead };
}

const gap = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('movement stays in sync and out of walls at 50, 120 and 250 ms, through stalls and a reconnect', async ({ browser }, info) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString(36).slice(-5);
  const [p1, p2] = await Promise.all([`l1_${stamp}`, `l2_${stamp}`].map((n) => signUp(browser, n)));
  await p1.getByRole('button', { name: 'Clock In' }).click();
  await p1.locator('#create-lobby').click();
  const code = (await p1.locator('#room-code').textContent())?.trim() ?? '';
  await p2.getByRole('button', { name: 'Clock In' }).click();
  await p2.locator('#join-code').fill(code);
  await p2.locator('#join-btn').click();
  await expect(p2.locator('#room-code')).toHaveText(code);
  await p2.locator('#ready-btn').click();
  await p1.locator('#start-btn').click();
  for (const p of [p1, p2]) {
    await p.waitForFunction(() => Boolean((globalThis as unknown as { __fr?: Fr }).__fr), null, { timeout: 30_000 });
    await p.evaluate(() => {
      const w = globalThis as unknown as { __fr: Fr; __frAuto: boolean };
      w.__frAuto = true; // drive with held keys, no pointer lock in headless
      w.__fr.debug.hideUi();
    });
  }
  const p1Id = await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.myId);
  // FAST_NIGHT reaches 6 AM in about a minute; hold the clock so the shift outlasts the measurements.
  await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.holdClock(true));

  const profiles = [
    { name: 'lag 50 ms', lagMs: 50, jitterMs: 10, stallEveryMs: 0, stallMs: 0 },
    { name: 'lag 120 ms', lagMs: 120, jitterMs: 25, stallEveryMs: 0, stallMs: 0 },
    { name: 'lag 250 ms', lagMs: 250, jitterMs: 50, stallEveryMs: 0, stallMs: 0 },
    { name: 'lag 120 ms + stalls', lagMs: 120, jitterMs: 25, stallEveryMs: 2500, stallMs: 450 },
  ];
  const results: Record<string, unknown>[] = [];
  for (const prof of profiles) {
    await p1.evaluate((pp) => (globalThis as unknown as { __fr: Fr }).__fr.debug.net(pp), prof);
    // Start in the West Hall facing south, walk its length, then strafe hard into the west wall and run diagonally
    // into the party-room doorframes: plenty of wall contact for prediction and the server to disagree about.
    await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.teleport(12, 26, 0, Math.PI, 0));
    await p1.waitForTimeout(1500);
    let hits = 0;
    let lead = 0;
    for (const [keys, ms] of [[['KeyW'], 2500], [['KeyD'], 1200], [['KeyW', 'KeyD'], 1500], [['KeyW', 'KeyA', 'ShiftLeft'], 1500]] as const) {
      const r = await hold(p1, [...keys], ms);
      hits += r.hits;
      lead = Math.max(lead, r.lead);
    }
    // Let the last commands and snapshots land, then compare.
    await p1.waitForTimeout(1500 + prof.lagMs * 4 + prof.stallMs);
    const me = await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.state());
    const server = await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.server());
    const seen = await p2.evaluate((id) => {
      const b = (globalThis as unknown as { __fr: Fr }).__fr.sim.players.get(id)?.body;
      return b ? { x: b.x, z: b.z } : null;
    }, p1Id);
    expect(server, prof.name).not.toBeNull();
    expect(seen, prof.name).not.toBeNull();
    const row = { profile: prof.name, end: { x: me.x, z: me.z, room: me.room }, maxLeadWhileWalking: lead, predictedVsServer: gap(me, server!), otherClientVsServer: gap(seen!, server!), samplesInWall: hits };
    results.push(row);
    expect(hits, `${prof.name}: predicted body inside a wall`).toBe(0);
    expect(gap(me, server!), `${prof.name}: prediction vs server`).toBeLessThan(0.15);
    expect(gap(seen!, server!), `${prof.name}: other client vs server`).toBeLessThan(0.6);
    expect(me.room, prof.name).not.toBeNull();
    // Walking at 2.8 m/s, a round trip of 2 x lag puts the server measurably behind the prediction.
    expect(lead, `${prof.name}: shaping in effect`).toBeGreaterThan((2 * prof.lagMs * 2.8) / 1000 * 0.5);
  }

  // Reconnect mid-shift: drop the transport, let Socket.IO come back, keep walking.
  await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.net({ lagMs: 0, jitterMs: 0, stallEveryMs: 0, stallMs: 0 }));
  await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.drop());
  await p1.waitForTimeout(4000);
  await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.teleport(12, 30, 0, Math.PI, 0));
  await p1.waitForTimeout(1200);
  const hitsAfter = (await hold(p1, ['KeyW'], 2000)).hits;
  await p1.waitForTimeout(1500);
  const me = await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.state());
  const server = await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.server());
  results.push({ profile: 'after reconnect', end: { x: me.x, z: me.z, room: me.room }, predictedVsServer: gap(me, server!), samplesInWall: hitsAfter });
  expect(hitsAfter).toBe(0);
  expect(me.z).toBeGreaterThan(33); // actually moved after the reconnect
  expect(gap(me, server!)).toBeLessThan(0.15);
  await expect.poll(() => p2.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.remotes().length), { timeout: 15_000 }).toBe(1);

  await info.attach('net-results.json', { body: JSON.stringify(results, null, 1), contentType: 'application/json' });
  console.log(JSON.stringify(results));
});
