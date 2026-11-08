import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',
 testMatch:'pdf-highlights.spec.ts',
 fullyParallel:false,
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:4174',channel:'msedge',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{command:'node tests/e2e/pdf-preview-server.mjs',url:'http://127.0.0.1:4174/tests/e2e/fixtures/pdf-viewer.html',reuseExistingServer:false,timeout:120_000},
});
