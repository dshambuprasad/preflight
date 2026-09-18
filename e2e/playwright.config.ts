import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  use: { baseURL: process.env.PREFLIGHT_WEB_URL ?? 'http://localhost:8080', screenshot: 'only-on-failure' },
  reporter: [['list']],
});
