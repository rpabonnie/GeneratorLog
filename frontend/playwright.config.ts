import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter generatorlog-backend dev',
      cwd: projectRoot,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm dev --host --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
