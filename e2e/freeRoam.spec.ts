import { test, expect, type Browser, type Page } from '@playwright/test';

// Four browsers play a FAST_NIGHT free-roam Night 1. Driving first-person mouse look headless is flaky, so
// the test uses the TEST_HOOKS API (window.__fr) to teleport players to objectives and press them.

async function signUp(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
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

type Fr = {
  debug: {
    state(): { room: string | null; x: number; z: number };
    teleport(x: number, z: number, y?: number, yaw?: number): void;
    act(a: unknown): void;
    remotes(): string[];
    powerState(): { main: boolean; circuits: string[] };
    hideUi(): void;
  };
  sim: { players: Map<string, unknown> };
};

test('four guards walk the free-roam pizzeria together and reach 6 AM', async ({ browser }, info) => {
  const stamp = Date.now().toString(36).slice(-5);
  const names = [0, 1, 2, 3].map((i) => `r${i}_${stamp}`);
  const pages = await Promise.all(names.map((n) => signUp(browser, n)));
  const shot = async (p: Page, label: string) => info.attach(label, { body: await p.screenshot(), contentType: 'image/png' });
  const [p1, p2, p3, p4] = pages;

  await p1.getByRole('button', { name: 'Clock In' }).click();
  await p1.locator('#create-lobby').click();
  const code = (await p1.locator('#room-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z]{4}$/);
  for (const p of [p2, p3, p4]) {
    await p.getByRole('button', { name: 'Clock In' }).click();
    await p.locator('#join-code').fill(code);
    await p.locator('#join-btn').click();
    await expect(p.locator('#room-code')).toHaveText(code);
  }
  await expect(p1.locator('#lobby-players .pcard')).toHaveCount(4);

  // Player 2 changes skin; Player 1 sees it live in the lobby.
  await p2.locator('#change-skin').click();
  await p2.locator('[data-cosmetic=guard_graveyard_grey]').click();
  await p2.locator('#locker-back').click();
  await expect(p1.locator(`[data-player="${names[1]}"] [data-skin="Graveyard Grey"]`)).toBeVisible();

  for (const p of [p2, p3, p4]) await p.locator('#ready-btn').click();
  await p1.locator('#start-btn').click();

  // Everyone spawns in the Staff Entrance and sees the other three guards.
  for (const p of pages) {
    await p.waitForFunction(() => Boolean((globalThis as unknown as { __fr?: Fr }).__fr), null, { timeout: 30_000 });
    await p.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.hideUi());
  }
  for (const p of pages) {
    await expect.poll(() => p.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.state().room), { timeout: 15_000 }).toBe('staff');
    await expect.poll(() => p.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.remotes().length), { timeout: 15_000 }).toBe(3);
  }
  await shot(p1, 'spawn');

  // Player 1 goes down to the Breaker Room and throws the main breaker; everyone sees the power come on.
  await p1.evaluate(() => {
    const fr = (globalThis as unknown as { __fr: Fr }).__fr;
    fr.debug.teleport(23.4, 60, -4.5, Math.PI / 2);
  });
  await p1.waitForTimeout(500);
  await p1.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.act({ type: 'item', id: 'main-breaker' }));
  for (const p of pages) await expect.poll(() => p.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.powerState().main), { timeout: 10_000 }).toBe(true);

  // Player 2 lights the Dining Hall at its switch.
  await p2.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.teleport(34.5, 11.2, 0, 0));
  await p2.waitForTimeout(500);
  await p2.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.act({ type: 'item', id: 'switch:dining' }));
  for (const p of pages) await expect.poll(() => p.evaluate(() => (globalThis as unknown as { __fr: Fr }).__fr.debug.powerState().circuits.includes('dining')), { timeout: 10_000 }).toBe(true);
  await p2.waitForTimeout(800);
  await shot(p2, 'dining-lit');

  // 6 AM and the paycheck on every screen.
  for (const p of pages) await expect(p.locator('#paycheck')).toBeVisible({ timeout: 120_000 });
  await shot(p1, 'paycheck');
  for (const p of pages) {
    const me = await p.request.get('/api/me');
    const body = (await me.json()) as { stats: { nights_survived: number } };
    expect(body.stats.nights_survived).toBeGreaterThanOrEqual(1);
  }
});
