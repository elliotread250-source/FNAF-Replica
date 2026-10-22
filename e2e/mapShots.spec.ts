import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

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
});
