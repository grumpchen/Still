import { defineConfig } from '@playwright/test';
const executablePath=process.env.STILL_PLAYWRIGHT_EXECUTABLE_PATH;
const port=process.env.STILL_PLAYWRIGHT_PORT||'4174';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...(executablePath?{launchOptions:{executablePath}}:{channel:'msedge'}),
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/design-preview.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
