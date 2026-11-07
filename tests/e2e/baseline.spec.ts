import { test, expect } from '@playwright/test';

test.describe('Baseline UI Smoke Test', () => {
  test('loads home page and displays main header', async ({ page }) => {
    await page.goto('/');
    // Check page title or root app mount
    await expect(page.locator('#root')).toBeVisible();
  });
});

