import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ROOMS } from '../shared/src/world/layout';

// Manual: real in-game captures of the Security Office hero views (docs/MAP_REBUILD_PROGRESS.md, spec 6).
// MAP_SHOTS=1 npx playwright test mapShots   (add E2E_URL=https://... to shoot a deployed build)
test.skip(!process.env.MAP_SHOTS, 'manual map screenshot pass');

const OUT = process.env.MAP_SHOTS_DIR ?? 'docs/screenshots/map';
const N = 0;
const E = -Math.PI / 2;
const W = Math.PI / 2;

type Fr = {
  debug: {
    teleport(x: number, z: number, y?: number, yaw?: number, pitch?: number): void;
    hideUi(): void;
    power(main: boolean, circuits?: string[]): void;
    act(a: unknown): void;
    agent(id: string, x: number, z: number): void;
    overlay(on: boolean): void;
  };
  me: { body: { stance: number; height: number } };
  stanceToggle: number;
  sim: { doorTarget: Float32Array; world: { doorOpen: Float32Array }; office: { sit(p: unknown): void; doorL: number; doorR: number; lights: { L: boolean; R: boolean } } };
};

async function frame(page: Page, name: string, setup: string, settle = 900): Promise<void> {
  await page.evaluate(setup);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85 });
}

test('security office hero views', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.goto(`${process.env.E2E_URL ?? ''}/?perf=high`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play as Guest' }).click();
  await page.getByRole('button', { name: 'Explore the Pizzeria (Day Shift)' }).click();
  await page.waitForFunction(() => Boolean((globalThis as unknown as { __fr?: Fr }).__fr), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = globalThis as unknown as { __fr: Fr; __frAuto: boolean };
    w.__frAuto = true;
    w.__fr.debug.hideUi();
    // Keep the cast out of the hero shots.
    for (const id of ['freddy', 'bonnie', 'chica', 'foxy']) w.__fr.debug.agent(id, 61, 15);
  });
  await page.waitForTimeout(3000);
  const fr = 'window.__fr';
  const tp = (x: number, z: number, yaw: number, pitch = 0) => `${fr}.debug.teleport(${x}, ${z}, 0, ${yaw}, ${pitch});`;

  await frame(page, 'office-1-west-hall-through-left-shutter', tp(18.6, 51, E, -0.05));
  await frame(page, 'office-2-east-hall-through-right-shutter', tp(31.4, 51, W, -0.05));
  await frame(page, 'office-3-rear-toward-desk', tp(25, 55.4, N, -0.12));
  await frame(page, 'office-4-seated-eye-central-wall', `${fr}.sim.office.sit(${fr}.me);`, 1500);
  await frame(page, 'office-4b-seated-look-left-panel', `${fr}.yaw = 1.1; ${fr}.pitch = -0.1;`);
  await frame(page, 'office-5-crouch-near-desk', `${fr}.debug.act({ type: 'stand' }); ${fr}.stanceToggle = 2; ${tp(26.2, 50.6, N + 0.25, 0.05)}`, 1600);
  await frame(page, 'office-closeup-fan', `${fr}.stanceToggle = 0; ${tp(25.75, 50.25, N + 0.15, -0.55)}`, 1200);
  await frame(page, 'office-closeup-crts', tp(24.6, 50.15, N - 0.05, -0.5));
  await frame(page, 'office-closeup-poster', tp(24.6, 50.15, N, 0.35));
  await frame(page, 'office-closeup-left-panel-and-track', tp(23.2, 50.0, W + 0.5, -0.25));
  await frame(page, 'office-shutters-closed', `for (const i of [${fr}.sim.office.doorL, ${fr}.sim.office.doorR]) { ${fr}.sim.doorTarget[i] = 0; ${fr}.sim.world.doorOpen[i] = 0; } ${tp(25, 52.5, N, -0.05)}`);
  await frame(page, 'office-power-out', `${fr}.debug.power(false); ${tp(25, 53.5, N, -0.1)}`, 4000);
  // Collider overlay (F9): the office kit boxes, the shutters, a swing door caught half open.
  await frame(page, 'overlay-office', `${fr}.debug.power(true, ['office']); ${fr}.debug.overlay(true); ${tp(25, 54.6, N, -0.35)}`, 1200);
  await frame(page, 'overlay-door-half-open', `for (const d of ${fr}.sim.level.doors) if (d.name === 'Staff Entrance interior door') { ${fr}.sim.doorTarget[d.id] = 0.5; ${fr}.sim.world.doorOpen[d.id] = 0.5; } ${tp(5, 63.2, N, -0.25)}`, 1200);
});

// One wide frame per room, from inside a corner looking across it at standing eye height.
test('room tour', async ({ page }) => {
  const dir = process.env.ROOM_SHOTS_DIR ?? `${OUT}/rooms`;
  mkdirSync(dir, { recursive: true });
  await page.goto(`${process.env.E2E_URL ?? ''}/?perf=high`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play as Guest' }).click();
  await page.getByRole('button', { name: 'Explore the Pizzeria (Day Shift)' }).click();
  await page.waitForFunction(() => Boolean((globalThis as unknown as { __fr?: Fr }).__fr), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const w = globalThis as unknown as { __fr: Fr; __frAuto: boolean };
    w.__frAuto = true;
    w.__fr.debug.hideUi();
    for (const id of ['freddy', 'bonnie', 'chica', 'foxy']) w.__fr.debug.agent(id, 61, 15);
  });
  await page.waitForTimeout(3000);
  const only = process.env.ROOMS ? process.env.ROOMS.split(',') : null;
  const perf: Record<string, unknown> = {};
  // The canonical rooms are shot from where a 2014 camera (or a guard walking in) would see them.
  const look = (x: number, z: number, tx: number, tz: number) => ({ x, z, yaw: Math.atan2(-(tx - x), -(tz - z)) });
  const VIEWS: Record<string, { x: number; z: number; yaw: number }> = {
    stage: look(50.5, 16, 62, 15),
    dining: look(34, 11, 34, 31),
    cove: look(17, 13, 8, 16),
    westHall: look(12, 23.2, 12, 50),
    westCorner: look(21.2, 48.8, 16, 51.5),
    eastHall: look(34, 33.2, 34, 52),
    eastCorner: look(31.2, 48.8, 28, 51.5),
    supply: look(33.5, 52.8, 30.5, 55.5),
    backstage: look(66.5, 35, 56, 29),
    kitchen: look(37.5, 47, 46, 46),
    men: look(41.4, 34.6, 47, 36.4),
    women: look(38.2, 40.8, 46.5, 42.5),
    restCorr: look(37, 32.6, 39, 36.5),
  };
  for (const r of ROOMS) {
    if (only && !only.includes(r.id)) continue;
    if (r.id === 'stairBot') continue;
    const [x1, z1, x2, z2] = r.rects[0];
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    // Stand 0.8 m in from the corner nearest the room's first opening-free corner, look at the far corner.
    const v = VIEWS[r.id];
    const sx = v ? v.x : x2 - x1 > 3 ? x1 + 0.8 : cx;
    const sz = v ? v.z : z2 - z1 > 3 ? z2 - 0.8 : cz;
    const yaw = v ? v.yaw : Math.atan2(-(cx + (x2 - x1) * 0.25 - sx), -(cz - (z2 - z1) * 0.25 - sz));
    await page.evaluate(({ x, z, y, yaw }) => (globalThis as unknown as { __fr: Fr }).__fr.debug.teleport(x, z, y, yaw, -0.08), { x: sx, z: sz, y: r.floorY, yaw });
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${dir}/${r.id}.jpg`, type: 'jpeg', quality: 80 });
    perf[r.id] = await page.evaluate(() => (globalThis as unknown as { __fr: { debug: { perf(): unknown } } }).__fr.debug.perf());
  }
  writeFileSync(`${dir}/perf.json`, JSON.stringify(perf, null, 1));
});

test('seated classic office shares the desk set', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.goto(`${process.env.E2E_URL ?? ''}/?perf=high`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play as Guest' }).click();
  await page.getByRole('button', { name: 'Clock In' }).click();
  await page.getByText('Classic Office (solo)').click();
  await page.locator('#create-lobby').click();
  await page.locator('#start-btn').click();
  await page.waitForTimeout(6000);
  await page.mouse.move(640, 360);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/seated-office-centre.jpg`, type: 'jpeg', quality: 85 });
  await page.mouse.move(120, 360);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/seated-office-left.jpg`, type: 'jpeg', quality: 85 });
});
