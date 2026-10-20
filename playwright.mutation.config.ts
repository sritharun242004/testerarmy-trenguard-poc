import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './mutation-tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'PROOFFORGE_MUTATION=M1 pnpm dev -- --port 4174',
    url: 'http://127.0.0.1:4174/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
