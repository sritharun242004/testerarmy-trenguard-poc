import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
  projectId: 'proofforge-testerarmy-adapter',
  tests: ['testerarmy-tests/**/*.e2e.ts'],
  workers: 1,
  retries: 0,
  cache: 'off',
  reporters: ['json'],
  targets: [
    {
      name: 'chromium',
      engine: web({ browser: 'chromium' }),
      app: {
        url: 'http://127.0.0.1:0',
        command: {
          executable: 'pnpm',
          args: ['dev', '--', '--port', '{port}'],
        },
      },
    },
  ],
} satisfies E2EConfig;
