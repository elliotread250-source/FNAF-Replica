import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Manual: run against the deployed URL to refresh docs/screenshots (E2E_URL=https://... npx playwright test visualSmoke).
test.skip(!process.env.VISUAL_SMOKE, 'manual visual smoke test');

test('title, office and a camera feed', async ({ page }) => {
  mkdirSync('docs/screenshots', { recursive: true });
  await page.goto(process.env.E2E_URL ?? '/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'docs/screenshots/title.png' });
  await page.getByRole('button', { name: 'Play as Guest' }).click();
  await page.getByRole('button', { name: 'Clock In' }).click();
  await page.getByText('Classic Office (solo)').click();
  await page.locator('#create-lobby').click();
  await page.locator('#start-btn').click();
  await page.waitForTimeout(5000);
  await page.mouse.move(80, 360);
  await page.waitForTimeout(1200);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/office.png' });
  await page.keyboard.up('KeyZ');
  await page.mouse.move(640, 360);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshots/camera.png' });
});
