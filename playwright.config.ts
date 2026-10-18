import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'node server/dist/index.js',
        url: `http://localhost:${PORT}/healthz`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          PORT: String(PORT),
          NODE_ENV: 'development',
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/fnaf_e2e',
          SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
          FAST_NIGHT: '1',
          TEST_SEED: '1234',
          TEST_HOOKS: '1',
          LOG_LEVEL: 'warn',
        },
      },
});
