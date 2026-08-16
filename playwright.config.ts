import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    channel: 'chrome',
    headless: true
  },
  projects: [
    { name: 'desktop-lg', use: { viewport: { width: 1920, height: 945 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-sm', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'tablet-portrait', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
  ]
});
