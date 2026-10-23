import { test, expect, type Page, type CDPSession } from '@playwright/test';

// A landscape phone (Pixel-class, 915 x 412 CSS px, touch only). Every touch here goes through Chrome's real input
// pipeline (CDP Input.dispatchTouchEvent), so the game sees the same pointer events a phone sends.
test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

type Fr = {
  debug: {
    state(): { x: number; z: number; room: string | null };
    look(): { yaw: number; pitch: number; flash: boolean; map: boolean; stance: number; touch: boolean };
    teleport(x: number, z: number, y?: number, yaw?: number, pitch?: number): void;
  };
};

const fr = <T>(p: Page, f: (d: Fr['debug']) => T) =>
  p.evaluate(`(${f.toString()})(globalThis.__fr.debug)`) as Promise<T>;

/** One finger: down at a, slide to b over `steps` moves, hold there `holdMs`, lift. */
async function drag(
  cdp: CDPSession,
  id: number,
  a: [number, number],
  b: [number, number],
  steps: number,
  holdMs: number,
  page: Page,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1], id }] });
  for (let i = 1; i <= steps; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / steps;
    const y = a[1] + ((b[1] - a[1]) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function tapButton(page: Page, id: string): Promise<void> {
  await page.locator(`[data-touch="${id}"]`).tap();
}

async function noOverflow(page: Page, where: string): Promise<void> {
  const o = (await page.evaluate('({ w: document.documentElement.scrollWidth, vw: window.innerWidth })')) as { w: number; vw: number };
  expect(o.w, `${where}: page wider than the screen`).toBeLessThanOrEqual(o.vw + 1);
}

async function guestToPlay(page: Page): Promise<void> {
  await page.goto('/?perf=low');
  await page.getByRole('button', { name: 'Continue' }).tap();
  await noOverflow(page, 'title');
  await page.getByRole('button', { name: 'Play as Guest' }).tap();
  await page.getByRole('button', { name: 'Clock In' }).tap();
  await noOverflow(page, 'play');
}

test('free roam on a phone: joystick walks, drag looks, buttons press', async ({ page }, info) => {
  await guestToPlay(page);
  await page.locator('#create-lobby').tap();
  await noOverflow(page, 'lobby');
  await page.locator('#start-btn').tap();
  await page.waitForFunction(() => Boolean((globalThis as unknown as { __fr?: Fr }).__fr), null, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-touch="use"]')).toBeVisible();
  await expect(page.locator('[data-touch="jump"]')).toBeVisible();
  expect((await fr(page, (d) => d.look())).touch).toBe(true);
  await info.attach('freeroam-phone.png', { path: await page.screenshot({ path: info.outputPath('freeroam-phone.png') }).then(() => info.outputPath('freeroam-phone.png')), contentType: 'image/png' });

  const cdp = await page.context().newCDPSession(page);
  // Stand in the West Hall facing south down its length, then push the stick forward for two seconds.
  await fr(page, (d) => d.teleport(12, 26, 0, Math.PI, 0));
  await page.waitForTimeout(800);
  const before = await fr(page, (d) => d.state());
  await drag(cdp, 1, [150, 300], [150, 240], 8, 2000, page);
  await page.waitForTimeout(300);
  const after = await fr(page, (d) => d.state());
  expect(Math.hypot(after.x - before.x, after.z - before.z), 'joystick moved the guard').toBeGreaterThan(2);

  // Drag on the right half turns the view.
  const yaw0 = (await fr(page, (d) => d.look())).yaw;
  await drag(cdp, 2, [600, 200], [400, 200], 10, 0, page);
  const yaw1 = (await fr(page, (d) => d.look())).yaw;
  expect(Math.abs(yaw1 - yaw0), 'drag turned the view').toBeGreaterThan(0.5);

  // Buttons: flashlight toggles, crouch toggles, the map opens and closes.
  const flash0 = (await fr(page, (d) => d.look())).flash;
  await tapButton(page, 'flash');
  expect((await fr(page, (d) => d.look())).flash).toBe(!flash0);
  await tapButton(page, 'crouch');
  expect((await fr(page, (d) => d.look())).stance).toBe(1);
  await tapButton(page, 'crouch');
  await tapButton(page, 'map');
  expect((await fr(page, (d) => d.look())).map).toBe(true);
  await expect(page.locator('.fr-map')).toBeVisible();
  await tapButton(page, 'map');
  expect((await fr(page, (d) => d.look())).map).toBe(false);

  // The menu button opens the pause screen; a tap resumes.
  await tapButton(page, 'menu');
  await expect(page.locator('.fr-pause')).toBeVisible();
  await page.locator('.fr-pause h2').tap();
  await expect(page.locator('.fr-pause')).toBeHidden();
  await noOverflow(page, 'free roam');
});

test('classic office on a phone: door, held light and cameras by touch', async ({ page }, info) => {
  await guestToPlay(page);
  await page.getByText('Classic Office (solo)').tap();
  await page.locator('#create-lobby').tap();
  await page.locator('#start-btn').tap();
  await expect(page.locator('[data-touch="doorL"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await info.attach('classic-phone.png', { path: await page.screenshot({ path: info.outputPath('classic-phone.png') }).then(() => info.outputPath('classic-phone.png')), contentType: 'image/png' });

  await tapButton(page, 'doorL');
  await expect(page.locator('.hud-icons .closed')).toHaveCount(1);
  await tapButton(page, 'doorL');
  await expect(page.locator('.hud-icons .closed')).toHaveCount(0);

  // Lights are hold-to-use by default: on while the finger is down, off when it lifts.
  const light = page.locator('[data-touch="lightR"]');
  const box = (await light.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
  });
  await expect(page.locator('.hud-icons .on', { hasText: '☀' })).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.hud-icons .on', { hasText: '☀' })).toHaveCount(0);

  await tapButton(page, 'tablet');
  await expect(page.locator('.cam-map')).toBeVisible();
  await info.attach('classic-phone-cams.png', { path: await page.screenshot({ path: info.outputPath('classic-phone-cams.png') }).then(() => info.outputPath('classic-phone-cams.png')), contentType: 'image/png' });
  await tapButton(page, 'tablet');
  await expect(page.locator('.cam-map')).toBeHidden();

  // Dragging across the office pans the view (no hover cursor on a phone, so no edge panning).
  await drag(cdp, 3, [700, 200], [200, 200], 10, 0, page);
  await noOverflow(page, 'classic');
});
