import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

const STATIONS = ['west', 'east', 'south', 'control'];

// Four live WebGL clients per test: close them afterwards, or they keep rendering and starve the next test.
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

test('four guards survive a FAST_NIGHT Night 1 together', async ({ browser }, info) => {
  const stamp = Date.now().toString(36).slice(-5);
  const names = [0, 1, 2, 3].map((i) => `g${i}_${stamp}`);
  const pages = await Promise.all(names.map((n) => signUp(browser, n)));
  const shot = async (p: Page, label: string) => info.attach(label, { body: await p.screenshot(), contentType: 'image/png' });

  // Player 1 creates a lobby and reads the code from the DOM.
  const [p1, p2, p3, p4] = pages;
  await p1.getByRole('button', { name: 'Clock In' }).click();
  await p1.getByText('Four Stations (co-op)').click();
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

  // Each picks a different station.
  for (const [i, p] of pages.entries()) await p.locator(`[data-station=${STATIONS[i]}]`).click();

  // Player 2 changes skin in the Locker Room; Player 1 sees it live.
  await p2.locator('#change-skin').click();
  await p2.locator('[data-cosmetic=guard_graveyard_grey]').click();
  await expect(p2.locator('[data-cosmetic=guard_graveyard_grey].equipped')).toBeVisible();
  await p2.locator('#locker-back').click();
  await expect(p1.locator(`[data-player="${names[1]}"] [data-skin="Graveyard Grey"]`)).toBeVisible();
  await shot(p1, 'lobby');

  for (const p of [p2, p3, p4]) await p.locator('#ready-btn').click();
  await expect(p1.locator('#start-btn')).toBeEnabled();
  await p1.locator('#start-btn').click();

  // Play, all four at once: tablet up, switch camera, tablet down, toggle the door.
  await Promise.all(
    pages.map(async (p, i) => {
      await expect(p.locator('.hud-power')).toContainText('Power left');
      const cam = p.locator('[data-cam=dining]');
      await expect(async () => {
        if (!(await cam.isVisible())) await p.keyboard.press('Space');
        await expect(cam).toBeVisible({ timeout: 1500 });
      }).toPass({ timeout: 12_000 });
      await cam.click({ timeout: 8000 });
      await p.keyboard.press('Space');
      if (i < 3) {
        const key = i === 1 ? 'KeyE' : 'KeyQ';
        await p.keyboard.press(key);
        await p.waitForTimeout(300);
        await p.keyboard.press(key);
      }
    }),
  );
  await shot(p1, 'office');

  // Wait for 6 AM and the paycheck on every screen.
  for (const p of pages) await expect(p.locator('#paycheck')).toBeVisible({ timeout: 90_000 });
  for (const [i, p] of pages.entries()) {
    const tokens = Number(((await p.locator('#pay-tokens').textContent()) ?? '').replace(/\D+/g, ' ').trim().split(' ')[0]);
    expect(tokens).toBeGreaterThan(0);
    const me = await p.request.get('/api/me');
    const body = (await me.json()) as { stats: { nights_survived: number } };
    expect(body.stats.nights_survived).toBe(1);
    if (i === 0) await shot(p, 'paycheck');
  }
});
