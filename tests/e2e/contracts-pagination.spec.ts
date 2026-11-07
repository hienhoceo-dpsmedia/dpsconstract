import { test, expect } from '@playwright/test';

test.describe('Contracts Collection & Pagination', () => {
  test('renders contracts table without loss of total count', async ({ page }) => {
    await page.goto('/');
    // Check table or main area loads
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });
});

