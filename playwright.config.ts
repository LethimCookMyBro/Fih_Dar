import { defineConfig, devices } from '@playwright/test';

// `tablet`/`tablet-portrait`/`mobile` below all previously ran on desktop
// Chrome (the old top-level `use.channel: 'chrome'` applied to every
// project) despite their names — that proves a viewport, not a touch/WebKit
// browser engine. The `*-webkit` projects are real WebKit (Safari's engine),
// the only automated stand-in this repo has for actual iPad/iPhone Safari.
// Automated WebKit still is not a physical device — see docs/DEPLOYMENT.md's
// note on manual iPad smoke-testing before relying on this alone.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    headless: true
  },
  projects: [
    { name: 'desktop-lg', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 945 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-sm', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'tablet-portrait', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1024, height: 768 } } },
    {
      name: 'tablet-portrait-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 768, height: 1024 } }
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }
  ]
});
