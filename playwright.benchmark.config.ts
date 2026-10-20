import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './benchmark-tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PROOFFORGE_BASE_URL ?? 'http://127.0.0.1:4175',
    trace: 'off',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
