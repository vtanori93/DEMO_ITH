import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 25_000,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium' },
    {
      name: 'firefox',
      testMatch: /(responsive|mobile-navigation|layout|indicators|view-loading)\.spec\.ts/,
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit-mobile',
      testMatch: /(responsive|mobile-navigation|layout|indicators|view-loading)\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
  ],
  webServer: {
    env: { VOLTIO_GATEWAY_CONFIG: ':memory:', NGROK_URL: '', PORT: '5174', HOST: '127.0.0.1' },
    command: process.env.VOLTIO_TEST_PRODUCTION === '1'
      ? 'npm run start:once'
      : 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
})
