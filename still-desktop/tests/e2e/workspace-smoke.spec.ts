import { expect, test } from '@playwright/test';

test('workspace dashboard loads', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('still-first-run-tutorial-v1', 'done');
  });

  await page.goto('/design-preview.html');
  await expect(page.getByRole('heading', { name: 'Your learning, in one place.' })).toBeVisible();
  await expect(page.locator('.dashboard-grid')).toBeVisible();
});
